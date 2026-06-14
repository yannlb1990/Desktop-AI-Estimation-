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
import { ArrowLeft, FileText, DollarSign, Ruler, Loader2, Settings, Calculator, TrendingUp, ShieldCheck, MapPin, User, Calendar as CalendarIcon, Clock, Bell, Package, ChevronDown, ChevronUp, Users, FolderOpen, Sofa, BookOpen, BarChart2, GitBranch, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubcontractorComparison } from "@/components/SubcontractorComparison";
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
import { DocumentLibrary } from "@/components/DocumentLibrary";
import { FFEModule } from "@/components/ffe/FFEModule";
import GanttSchedule from "@/components/GanttSchedule";
import JobCostTracker from "@/components/JobCostTracker";
import VariationsLog from "@/components/VariationsLog";
import { syncProjectToSupabase } from "@/lib/db/projects";
import { TourTip } from "@/components/TourTip";

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [activeMainTab, setActiveMainTab] = useState("takeoff");
  const [showSuppliers, setShowSuppliers] = useState(false);

  const preferredSuppliers: any[] = (() => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey("preferred_suppliers")) || "[]"); }
    catch { return []; }
  })();

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
      syncProjectToSupabase(projects[idx]);
    }
    toast.success("Due date updated");
  };

  const handleQuoteStatusChange = (status: string) => {
    if (!projectId) return;
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || "[]");
    const idx = projects.findIndex((p: any) => p.id === projectId);
    if (idx !== -1) {
      projects[idx].quoteStatus = status;
      projects[idx].updated_at = new Date().toISOString();
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
      setProject((prev: any) => ({ ...prev, quoteStatus: status }));
      syncProjectToSupabase(projects[idx]);
    }
    toast.success(`Status updated to ${status}`);
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
      let projectData = projects.find((p: any) => p.id === projectId);

      // If not in localStorage, try Supabase (cross-device access)
      if (!projectData) {
        const { loadProjectsFromSupabase } = await import('@/lib/db/projects');
        const dbProjects = await loadProjectsFromSupabase();
        projectData = dbProjects.find((p: any) => p.id === projectId);
        if (projectData) {
          // Cache locally for offline access
          const all = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
          all.unshift(projectData);
          localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(all));
        }
      }

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
              <TourTip text="Start your estimate from a pre-built template — New Build, Bathroom, Kitchen, Deck or Commercial Fitout. Loads all standard line items instantly." position="bottom">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveMainTab("estimate");
                    setTimeout(() => window.dispatchEvent(new Event("open-template-modal")), 100);
                  }}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </TourTip>
              <TourTip text="Generate a branded PDF quote — 2-page proposal with your logo, scope summary, pricing breakdown and signature block." position="bottom">
                <QuoteGenerator project={project} estimate={estimate} />
              </TourTip>
              <TourTip text="Create a full corporate tender document including company profile, methodology, NCC compliance, programme and legal terms." position="bottom">
                <FullTenderGenerator project={project} estimate={estimate} />
              </TourTip>
              <TourTip text="Download the complete estimate as a CSV file — open it in Excel or Google Sheets for further review or sharing." position="bottom">
                <Button onClick={handleExportCSV} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Export to Excel
                </Button>
              </TourTip>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-4xl font-bold">{project.name}</h1>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  project.status === "complete" || project.status === "completed"
                    ? "bg-accent/20 text-accent"
                    : "bg-primary/10 text-primary"
                }`}>
                  {project.status || "active"}
                </div>
                <TourTip text="Track the quote status: Draft (in progress), Sent (submitted to client), Won or Lost. This feeds your win rate on the dashboard." position="bottom">
                  <Select value={project.quoteStatus || "draft"} onValueChange={handleQuoteStatusChange}>
                    <SelectTrigger className={`h-7 w-auto text-xs px-2.5 border rounded-full ${
                      project.quoteStatus === "won" ? "border-green-400/50 bg-green-500/10 text-green-400" :
                      project.quoteStatus === "lost" ? "border-red-400/50 bg-red-500/10 text-red-400" :
                      project.quoteStatus === "sent" ? "border-purple-400/50 bg-purple-500/10 text-purple-400" :
                      "border-border bg-muted text-muted-foreground"
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </TourTip>
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
              <TourTip text="Set the deadline to complete this estimate. Helps you prioritise when you have multiple jobs on the go." position="left">
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
              </TourTip>
              <TourTip text="Save a reminder for this project's due date — shown on your dashboard so you never miss a submission." position="left">
                <Button variant="outline" onClick={sendReminder} size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Set Reminder
                </Button>
              </TourTip>
            </div>
          </div>
        </Card>

        {/* Preferred Suppliers quick reference */}
        {preferredSuppliers.length > 0 && (
          <div className="mb-4 border border-border rounded-xl bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
              onClick={() => setShowSuppliers(s => !s)}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                Preferred Suppliers ({preferredSuppliers.length})
              </span>
              {showSuppliers ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showSuppliers && (
              <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {preferredSuppliers.map((s: any) => (
                  <div key={s.id} className="text-xs border border-border rounded-lg p-3 bg-muted/20">
                    <div className="font-semibold text-foreground mb-1">{s.name}</div>
                    {s.contact && <div className="text-muted-foreground">{s.contact}</div>}
                    {s.phone && <div className="text-muted-foreground">{s.phone}</div>}
                    {s.account && <div className="font-mono bg-muted rounded px-1 inline-block mt-1">{s.account}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workflow progress strip */}
        <div className="flex items-center gap-0 rounded-xl border border-border bg-card p-1 mb-2 overflow-x-auto scrollbar-none">
          {[
            { key: "takeoff", label: "1. Takeoff", icon: Ruler, tour: "Upload your PDF plans here. AI measures quantities automatically — review and adjust each item, then send everything to Estimate." },
            { key: "estimate", label: "2. Estimate", icon: Calculator, tour: "Review and price all takeoff items. Add labour, materials, margins and overheads. This is your full cost build-up before generating the client document." },
            { key: "tender", label: "3. Tender", icon: FileText, tour: "Generate the final client document. Choose a Quote (fast 2-page branded proposal) or a full Tender with compliance, programme and legal terms." },
          ].map((step, i) => {
            const Icon = step.icon;
            const isActive = activeMainTab === step.key;
            const isPast =
              (step.key === "takeoff" && (activeMainTab === "estimate" || activeMainTab === "tender")) ||
              (step.key === "estimate" && activeMainTab === "tender");
            return (
              <React.Fragment key={step.key}>
                <TourTip text={step.tour} position="bottom">
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
                </TourTip>
                {i < 2 && (
                  <span className="text-muted-foreground/40 text-lg select-none px-1">›</span>
                )}
              </React.Fragment>
            );
          })}
          <div className="w-px bg-border mx-2 self-stretch" />
          {[
            { key: "overheads", label: "Overheads", icon: Settings,   tour: "Add company overheads — insurance, supervision, site costs, preliminaries. These are added on top of your direct estimate costs." },
            { key: "ffe",       label: "FF&E",       icon: Sofa,       tour: "Fixtures, Fittings & Equipment schedule. Enter appliances, furniture and fittings room by room with photos, supplier and pricing. Export as a branded PDF." },
            { key: "insights",  label: "Insights",   icon: TrendingUp, tour: "AI-generated cost breakdown analysis — compare your project's rates against current Australian market benchmarks." },
            { key: "compliance",label: "NCC",         icon: ShieldCheck,tour: "National Construction Code compliance checklist tailored to this project type. Identify gaps before submission." },
            { key: "subbies",   label: "Subbies",    icon: Users,      tour: "Enter and compare subcontractor quotes side by side for each trade. Easily select the best price and attach it to your estimate." },
            { key: "documents", label: "Docs",        icon: FolderOpen, tour: "Store all project documents in one place — contracts, variations, site photos, council approvals and correspondence." },
            { key: "schedule",  label: "Schedule",    icon: CalendarIcon, tour: "Auto-generate a Gantt chart from your estimate trades. Adjust durations and dependencies, then print or export." },
            { key: "jobcost",   label: "Job Cost",    icon: BarChart2,  tour: "Track actual costs against your estimate in real time. Log invoices and expenses by trade to see your live margin." },
            { key: "variations",label: "Variations",  icon: GitBranch,  tour: "Manage change orders with a full approval workflow — draft, send for approval, track accepted variations and update your contract sum." },
          ].map((tool) => {
            const Icon = tool.icon;
            return (
              <TourTip key={tool.key} text={tool.tour} position="bottom">
                <button
                  onClick={() => setActiveMainTab(tool.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    activeMainTab === tool.key
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tool.label}
                </button>
              </TourTip>
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
            <TabsTrigger value="subbies" />
            <TabsTrigger value="ffe" />
            <TabsTrigger value="documents" />
            <TabsTrigger value="pricing" />
            <TabsTrigger value="schedule" />
            <TabsTrigger value="jobcost" />
            <TabsTrigger value="variations" />
            {project.plan_file_url && <TabsTrigger value="plans" />}
          </TabsList>

          {/* Step 1 — PDF Takeoff — forceMount keeps PDF alive when switching to Estimate/Tender */}
          <TabsContent value="takeoff" forceMount className="space-y-4">
            <TakeoffErrorBoundary>
              <AIPlanAnalyzerEnhanced key={projectId} projectId={projectId!} estimateId={estimate?.id} />
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
                  <p className="text-xs text-muted-foreground mt-0.5">Quote — fast branded proposal · Tender — full compliance document.</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveMainTab("tender")}
                    className="border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Quote
                  </Button>
                  <Button
                    onClick={() => setActiveMainTab("tender")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Generate Tender
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </div>
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

          <TabsContent value="ffe">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => setActiveMainTab("estimate")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Estimate
            </Button>
            <FFEModule projectId={projectId!} projectName={project?.name} />
          </TabsContent>

          <TabsContent value="insights">
            <ProjectInsightsTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="compliance">
            <NCCComplianceCard projectId={projectId!} />
          </TabsContent>

          <TabsContent value="subbies">
            <SubcontractorComparison projectId={projectId!} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentLibrary
              projectId={projectId!}
              projectName={project.name}
              clientName={project.client_name}
              siteAddress={project.site_address}
            />
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

          <TabsContent value="schedule">
            <GanttSchedule projectId={projectId!} />
          </TabsContent>

          <TabsContent value="jobcost">
            <JobCostTracker projectId={projectId!} />
          </TabsContent>

          <TabsContent value="variations">
            <VariationsLog projectId={projectId!} projectName={project?.name ?? ""} clientEmail={project?.client_email} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDetail;
