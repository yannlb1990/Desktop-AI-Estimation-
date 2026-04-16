import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Upload, Zap, Loader2, FileText, Brain, CheckCircle } from "lucide-react";
import { z } from "zod";
import { analyzePDFWithData, PlanAnalysisResult, EstimatedLineItem } from "@/lib/aiPlanAnalyzer";
import AIPlanAnalyzer from "@/components/AIPlanAnalyzer";

const projectSchema = z.object({
  name: z.string().min(1, "Project name required").max(200),
  client_name: z.string().max(200).optional(),
  site_address: z.string().max(500).optional(),
});

const NewProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [analysisResult, setAnalysisResult] = useState<PlanAnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<'upload' | 'analyzing' | 'review' | 'complete'>('upload');
  const [selectedEstimateItems, setSelectedEstimateItems] = useState<EstimatedLineItem[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    client_name: "",
    site_address: "",
    plan_description: "",
  });

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "manual") {
      setActiveTab("manual");
    }
  }, [searchParams]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - only PDF for AI analysis
    if (file.type !== 'application/pdf') {
      toast.error("Please upload PDF files only for AI analysis");
      return;
    }

    // Validate file size (50MB)
    if (file.size > 52428800) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setUploadedFile(file);
    setAnalysisResult(null); // Reset any previous analysis
    setAnalysisStep('upload');
    toast.success(`${file.name} ready for analysis`);
  };

  const handlePlanUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      toast.error("Please select a plan file");
      return;
    }

    // Validate form data first
    try {
      projectSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);
    setIsAnalyzing(true);
    setAnalysisStep('analyzing');

    try {
      // Analyze the PDF and get both analysis result and ArrayBuffer
      toast.info("Analyzing PDF - extracting text, symbols, and schedules...");
      console.log(`[NewProject] Starting analysis of ${uploadedFile.name}`);

      const { analysis: result, arrayBuffer } = await analyzePDFWithData(uploadedFile);

      console.log(`[NewProject] Analysis complete. ArrayBuffer: ${arrayBuffer.byteLength} bytes, Pages: ${result.totalPages}`);

      // Set state in correct order
      setPdfData(arrayBuffer);
      setAnalysisResult(result);
      setAnalysisStep('review');

      toast.success(`Analysis complete! Found ${result.totalPages} pages with ${result.estimatedItems.length} estimated items.`);
    } catch (error) {
      console.error("[NewProject] PDF analysis error:", error);
      toast.error("Failed to analyze PDF. Please try again or use manual entry.");
      setAnalysisStep('upload');
      setPdfData(null);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleAcceptEstimate = (items: EstimatedLineItem[]) => {
    setSelectedEstimateItems(items);
    createProjectWithEstimate(items);
  };

  const createProjectWithEstimate = async (items: EstimatedLineItem[]) => {
    setIsLoading(true);
    try {
      const validData = projectSchema.parse(formData);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to create a project");
        navigate("/auth");
        return;
      }

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          created_by: user.id,
          name: validData.name,
          client_name: validData.client_name || null,
          site_address: validData.site_address || null,
          address: validData.site_address || "TBD",
          state: "NSW",
          postcode: "0000",
          plan_file_name: uploadedFile?.name || null,
          status: "in_progress",
        } as any)
        .select()
        .single();

      if (error) throw error;

      setAnalysisStep('complete');
      toast.success("Project created with AI-generated estimate!");

      setTimeout(() => {
        navigate(`/project/${project.id}`);
      }, 500);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Project creation error:", error);
        const msg = error?.message || error?.error_description || JSON.stringify(error);
        toast.error(`Failed to create project: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setAnalysisStep('analyzing');
    try {
      const { analysis: result, arrayBuffer } = await analyzePDFWithData(uploadedFile);
      setPdfData(arrayBuffer);
      setAnalysisResult(result);
      setAnalysisStep('review');
      toast.success("Reanalysis complete!");
    } catch (error) {
      console.error("Reanalysis error:", error);
      toast.error("Reanalysis failed");
      setAnalysisStep('review');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBackToUpload = () => {
    setAnalysisResult(null);
    setAnalysisStep('upload');
    setSelectedEstimateItems([]);
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = projectSchema.parse(formData);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to create a project");
        navigate("/auth");
        return;
      }

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          created_by: user.id,
          name: validData.name,
          client_name: validData.client_name || null,
          site_address: validData.site_address || null,
          address: validData.site_address || "TBD",
          state: "NSW",
          postcode: "0000",
          status: "in_progress",
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success("Project created!");
      navigate(`/project/${project.id}`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Project creation error:", error);
        const msg = error?.message || error?.error_description || JSON.stringify(error);
        toast.error(`Failed to create project: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If we're in the review step, show the AI Plan Analyzer
  if (analysisStep === 'review' && analysisResult) {
    return (
      <div className="min-h-screen bg-muted/30">
        <nav className="border-b border-border bg-background">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={handleBackToUpload}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              Analyzing: {formData.name || uploadedFile?.name}
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-8 max-w-6xl">
          <AIPlanAnalyzer
            analysis={analysisResult}
            pdfData={pdfData || undefined}
            onAcceptEstimate={handleAcceptEstimate}
            onReanalyze={handleReanalyze}
            isLoading={isAnalyzing}
          />
        </div>
      </div>
    );
  }

  // If we're in the analyzing step, show a loading state
  if (analysisStep === 'analyzing') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <Brain className="h-16 w-16 text-accent animate-pulse" />
              <Loader2 className="h-8 w-8 text-primary absolute -bottom-1 -right-1 animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Analyzing Your Plans</h2>
              <p className="text-muted-foreground">
                AI is reading your PDF and extracting construction details...
              </p>
            </div>
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Extracting text and dimensions</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>Recognizing symbols (doors, windows)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4" />
                <span>Parsing schedules</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4" />
                <span>Generating estimate</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // If complete, show success state
  if (analysisStep === 'complete') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <div className="flex flex-col items-center gap-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Project Created!</h2>
              <p className="text-muted-foreground">
                Redirecting to your project...
              </p>
            </div>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">New Project</h1>
          <p className="text-muted-foreground">
            Upload plans for AI-powered takeoff or create a manual estimate
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload Plans
            </TabsTrigger>
            <TabsTrigger value="manual">
              <FileText className="h-4 w-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card className="p-8">
              <form onSubmit={handlePlanUpload} className="space-y-6">
                <div>
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Duplex Build - Gold Coast"
                    required
                    maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client_name">Client Name</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="e.g., John Smith"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <Label htmlFor="site_address">Site Address</Label>
                    <Input
                      id="site_address"
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="e.g., 123 Main St, QLD 4217"
                      maxLength={500}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="plan_file">Upload Plan File (PDF) *</Label>
                  <div className="mt-2">
                    <Input
                      id="plan_file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      required
                      className="cursor-pointer"
                    />
                    {uploadedFile && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 50MB. Supported: PDF architectural drawings
                  </p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <Brain className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">AI-Powered Plan Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Our AI will automatically analyze your plans and:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">1.</span>
                          <span>Classify drawing types (floor plans, elevations, schedules, FF&E)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">2.</span>
                          <span>Detect construction type (timber frame, brick veneer, steel frame)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">3.</span>
                          <span>Recognize symbols (doors, windows, electrical, plumbing)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">4.</span>
                          <span>Parse window/door schedules and match to symbols</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">5.</span>
                          <span>Generate line-item estimate with Australian rates</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !uploadedFile}
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isAnalyzing ? "AI Analyzing..." : "Uploading..."}
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Analyze Plans
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card className="p-8">
              <form onSubmit={handleManualEntry} className="space-y-6">
                <div>
                  <Label htmlFor="manual-name">Project Name *</Label>
                  <Input
                    id="manual-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Extension - Brisbane"
                    required
                    maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="manual-client">Client Name</Label>
                    <Input
                      id="manual-client"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="e.g., Jane Doe"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <Label htmlFor="manual-address">Site Address</Label>
                    <Input
                      id="manual-address"
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="e.g., 456 Smith St, QLD 4000"
                      maxLength={500}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-secondary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Manual Estimation</h3>
                      <p className="text-sm text-muted-foreground">
                        Create a project without plan upload. You'll be able to manually add estimate line items organized by area, trade, and scope of work.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Create Project
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NewProject;