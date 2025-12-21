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
import { ArrowLeft, Upload, Zap, Loader2, FileText } from "lucide-react";
import { z } from "zod";

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
  const [activeTab, setActiveTab] = useState("upload");
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

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload PDF, PNG, or JPG files only");
      return;
    }

    // Validate file size (50MB)
    if (file.size > 52428800) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setUploadedFile(file);
    toast.success(`${file.name} ready to upload`);
  };

  const handlePlanUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      toast.error("Please select a plan file");
      return;
    }

    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const validData = projectSchema.parse(formData);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to create a project");
        navigate("/auth");
        return;
      }

      // Upload file to storage
      const fileExt = uploadedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(filePath, uploadedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plans')
        .getPublicUrl(filePath);

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: validData.name,
          client_name: validData.client_name || null,
          site_address: validData.site_address || null,
          plan_file_url: publicUrl,
          plan_file_name: uploadedFile.name,
          status: "in_progress",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      toast.success("Plan uploaded! AI analyzing...");

      // Run AI plan analysis
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-plan-takeoff', {
        body: {
          planUrl: publicUrl,
          projectName: validData.name
        }
      });

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        toast.error("Plan uploaded, but AI analysis failed");
      } else if (analysisData?.success) {
        toast.success("AI analysis complete!");
        
        // Store analysis results
        await supabase.from("ai_analyses").insert({
          project_id: project.id,
          user_id: user.id,
          analysis_type: 'takeoff',
          results: analysisData,
          confidence_score: analysisData.analysis?.confidence || 0.85
        });
      }

      navigate(`/project/${project.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Project creation error:", error);
        toast.error("Failed to create project");
      }
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = projectSchema.parse(formData);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to create a project");
        navigate("/auth");
        return;
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: validData.name,
          client_name: validData.client_name || null,
          site_address: validData.site_address || null,
          status: "in_progress",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create empty estimate for manual entry
      const { data: estimate } = await supabase
        .from("estimates")
        .insert({
          project_id: project.id,
          user_id: user.id,
        })
        .select()
        .single();

      toast.success("Project created!");
      navigate(`/project/${project.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Project creation error:", error);
        toast.error("Failed to create project");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
                  <Label htmlFor="plan_file">Upload Plan File (PDF, PNG, JPG) *</Label>
                  <div className="mt-2">
                    <Input
                      id="plan_file"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
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
                    Max 50MB. Supported: PDF, PNG, JPG
                  </p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <Zap className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">AI-Powered Plan Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Our AI will automatically:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">1.</span>
                          <span>Identify trade packages (Carpentry, Plumbing, Electrical, etc.)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">2.</span>
                          <span>Extract material quantities and specifications</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">3.</span>
                          <span>Estimate labour hours based on Australian productivity rates</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-accent font-bold">4.</span>
                          <span>Organize takeoff by area and scope of work</span>
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
                        <Upload className="mr-2 h-4 w-4" />
                        Upload & Analyze
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