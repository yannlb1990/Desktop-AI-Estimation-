import React, { useState, useEffect, Component } from "react";
import type { ReactNode } from "react";

// Isolate takeoff crashes so they don't white-out the entire project page
class TakeoffErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 border border-destructive/40 rounded-lg bg-destructive/5 text-destructive space-y-2">
          <p className="font-semibold">Takeoff module failed to load</p>
          <p className="text-sm font-mono">{this.state.error.message}</p>
          <button
            className="text-sm underline"
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useParams, useNavigate } from "react-router-dom";
import { isSignedIn, getUserStorageKey } from "@/lib/localAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, FileText, DollarSign, Ruler, Loader2, Settings, Calculator, TrendingUp, ShieldCheck, MapPin, User, Calendar as CalendarIcon, Clock, Bell } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { OverheadManager } from "@/components/OverheadManager";
import { EstimateTemplate } from "@/components/EstimateTemplate";
import { PlanViewer } from "@/components/PlanViewer";
import { TenderDocuments } from "@/components/TenderDocuments";
import { QuoteGenerator } from "@/components/QuoteGenerator";
import { FullTenderGenerator } from "@/components/FullTenderGenerator";
import { ProjectInsightsTab } from "@/components/ProjectInsightsTab";
import { NCCComplianceCard } from "@/components/NCCComplianceCard";
import { PlanAnalysisWizard } from "@/components/PlanAnalysisWizard";
import { AIPlanAnalyzerEnhanced } from "@/components/AIPlanAnalyzerEnhanced";

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [activeMainTab, setActiveMainTab] = useState("takeoff");

  const handleExportCSV = () => {
    if (!project) return;
    const items = estimate?.estimate_items || [];
    const rows = [
      ["Project", project.name],
      ["Client", project.client_name || ""],
      ["Address", project.site_address || project.address || ""],
      ["Status", project.status || ""],
      ["Exported", new Date().toLocaleDateString("en-AU")],
      [],
      ["Category", "Description", "Unit", "Qty", "Unit Price", "Total"],
      ...items.map((item: any) => [
        item.category || item.trade || "",
        item.description || item.name || "",
        item.unit || "",
        item.quantity || "",
        item.unit_price || item.unitCost || "",
        item.total_price || item.subtotal || "",
      ]),
    ];
    const csv = rows.map(r => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as CSV — open in Excel");
  };

  useEffect(() => {
    if (!isSignedIn()) {
      navigate("/auth");
      return;
    }
    loadProject();
  }, [projectId]);

  useEffect(() => {
    const handler = () => setActiveMainTab("estimate");
    window.addEventListener("go-to-estimate-tab", handler);
    return () => window.removeEventListener("go-to-estimate-tab", handler);
  }, []);

  const handleDueDateChange = (date: Date | undefined) => {
    if (!projectId) return;
    setDueDate(date);
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || "[]");
    const idx = projects.findIndex((p: any) => p.id === projectId);
    if (idx !== -1) {
      projects[idx].due_date = date?.toISOString() || null;
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    }
    toast.success("Due date updated");
  };

  const sendReminder = () => {
    if (!dueDate) {
      toast.error("Please set a due date first");
      return;
    }
    const reminders = JSON.parse(localStorage.getItem(getUserStorageKey('project_reminders')) || "{}");
    reminders[projectId!] = { projectName: project?.name, dueDate: dueDate.toISOString() };
    localStorage.setItem(getUserStorageKey('project_reminders'), JSON.stringify(reminders));
    const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    if (daysLeft < 0) {
      toast.warning(`Due date was ${Math.abs(daysLeft)} days ago — consider updating it`);
    } else if (daysLeft === 0) {
      toast.warning("Due today — make sure the estimate is complete");
    } else {
      toast.success(`Reminder saved — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} until ${format(dueDate, "PPP")}`);
    }
  };

  const loadProject = async () => {
    try {
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || "[]");
      const projectData = projects.find((p: any) => p.id === projectId);

      if (!projectData) {
        toast.error("Project not found");
        navigate("/dashboard");
        return;
      }

      setProject(projectData);
      setAnalyses([]);
      setEstimate({ id: `estimate-${projectId}`, project_id: projectId, estimate_items: [] });

      if (projectData.due_date) {
        setDueDate(new Date(projectData.due_date));
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const takeoffAnalysis = analyses.find(a => a.analysis_type === 'takeoff');
  const pricingAnalysis = analyses.find(a => a.analysis_type === 'pricing');

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex gap-2">
              <QuoteGenerator project={project} estimate={estimate} />
              <FullTenderGenerator project={project} estimate={estimate} />
              <Button onClick={handleExportCSV} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Export to Excel
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-4xl font-bold">{project.name}</h1>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  project.status === "complete" || project.status === "completed"
                    ? "bg-accent/20 text-accent"
                    : "bg-primary/10 text-primary"
                }`}>
                  {project.status || "active"}
                </div>
              </div>
              <div className="text-muted-foreground space-y-1">
                {project.site_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Address: {project.site_address}</span>
                  </div>
                )}
                {project.client_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Client: {project.client_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Complete estimate by:</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left w-[240px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDueDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" onClick={sendReminder} size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Set Reminder
              </Button>
            </div>
          </div>
        </Card>

        {/* Workflow progress strip */}
        <div className="flex items-center gap-0 rounded-xl border border-border bg-card p-1 mb-2">
          {[
            { key: "takeoff", label: "1. Takeoff", icon: Ruler },
            { key: "estimate", label: "2. Estimate", icon: Calculator },
            { key: "tender", label: "3. Tender", icon: FileText },
          ].map((step, i) => {
            const Icon = step.icon;
            const isActive = activeMainTab === step.key;
            const isPast =
              (step.key === "takeoff" && (activeMainTab === "estimate" || activeMainTab === "tender")) ||
              (step.key === "estimate" && activeMainTab === "tender");
            return (
              <React.Fragment key={step.key}>
                <button
                  onClick={() => setActiveMainTab(step.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1 justify-center ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : isPast
                      ? "text-primary/80 hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {step.label}
                  {isPast && <span className="ml-1 text-xs opacity-70">✓</span>}
                </button>
                {i < 2 && (
                  <span className="text-muted-foreground/40 text-lg select-none px-1">›</span>
                )}
              </React.Fragment>
            );
          })}
          <div className="w-px bg-border mx-2 self-stretch" />
          {[
            { key: "overheads", label: "Overheads", icon: Settings },
            { key: "insights", label: "Insights", icon: TrendingUp },
            { key: "compliance", label: "NCC", icon: ShieldCheck },
          ].map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.key}
                onClick={() => setActiveMainTab(tool.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeMainTab === tool.key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tool.label}
              </button>
            );
          })}
        </div>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="takeoff" />
            <TabsTrigger value="estimate" />
            <TabsTrigger value="tender" />
            <TabsTrigger value="overheads" />
            <TabsTrigger value="insights" />
            <TabsTrigger value="compliance" />
            <TabsTrigger value="pricing" />
            {project.plan_file_url && <TabsTrigger value="plans" />}
          </TabsList>

          {/* Step 1 — PDF Takeoff — forceMount keeps PDF alive when switching to Estimate/Tender */}
          <TabsContent value="takeoff" forceMount className="space-y-4">
            <TakeoffErrorBoundary>
              <AIPlanAnalyzerEnhanced projectId={projectId!} estimateId={estimate?.id} />
            </TakeoffErrorBoundary>
            <Card className="p-4 border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Done measuring and costing?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use "Send All to Estimate" in the Costs tab above, then review your full estimate.
                  </p>
                </div>
                <Button
                  onClick={() => setActiveMainTab("estimate")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 ml-4"
                >
                  View Estimate
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Step 2 — Estimate */}
          <TabsContent value="estimate" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setActiveMainTab("takeoff")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Takeoff
              </Button>
              <Button
                onClick={() => setActiveMainTab("tender")}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
              >
                Estimate looks good? Generate Tender
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
            {estimate ? (
              <EstimateTemplate projectId={projectId!} estimateId={estimate.id} />
            ) : (
              <Card className="p-6">
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading estimate...</p>
                </div>
              </Card>
            )}
            <Card className="p-4 border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Ready to send this to the client?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate a professional Quote or full Tender document.</p>
                </div>
                <Button
                  onClick={() => setActiveMainTab("tender")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 ml-4"
                >
                  Generate Tender
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Step 3 — Tender */}
          <TabsContent value="tender" className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setActiveMainTab("estimate")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Estimate
            </Button>
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-2">Generate Quote or Tender</h3>
              <p className="text-muted-foreground mb-4">
                <strong>Quote</strong> — fast, branded proposal with scope, pricing and signature block.<br />
                <strong>Tender</strong> — full corporate document with company profile, compliance, methodology, programme and legal terms.
              </p>
              <div className="flex gap-3">
                <QuoteGenerator project={project} estimate={estimate} />
                <FullTenderGenerator project={project} estimate={estimate} />
              </div>
            </Card>
            <TenderDocuments projectId={projectId!} />
          </TabsContent>

          {/* Tools */}
          <TabsContent value="overheads">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => setActiveMainTab("estimate")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Estimate
            </Button>
            <OverheadManager projectId={projectId!} />
          </TabsContent>

          <TabsContent value="insights">
            <ProjectInsightsTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="compliance">
            <NCCComplianceCard projectId={projectId!} />
          </TabsContent>

          <TabsContent value="pricing">
            <Card className="p-6">
              <h2 className="font-display text-2xl font-bold mb-4">AI Pricing</h2>
              <p className="text-muted-foreground">AI pricing analysis in progress...</p>
            </Card>
          </TabsContent>

          {project.plan_file_url && (
            <TabsContent value="plans">
              <PlanAnalysisWizard planUrl={project.plan_file_url} projectId={projectId!} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDetail;
