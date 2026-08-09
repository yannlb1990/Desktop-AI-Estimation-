import React, { useState, useEffect, useRef, Component } from "react";
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
import { ArrowLeft, FileText, DollarSign, Ruler, Loader2, Settings, Calculator, TrendingUp, ShieldCheck, MapPin, User, Calendar as CalendarIcon, Clock, Bell, Package, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, FolderOpen, Sofa, BookOpen, BarChart2, GitBranch, PlusCircle, Check, Monitor, ClipboardList } from "lucide-react";
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
import { AIPlanAnalyzerEnhanced } from "@/components/AIPlanAnalyzerEnhanced";
import { DocumentLibrary } from "@/components/DocumentLibrary";
import { FFEModule } from "@/components/ffe/FFEModule";
import GanttSchedule from "@/components/GanttSchedule";
import JobCostTracker from "@/components/JobCostTracker";
import VariationsLog from "@/components/VariationsLog";
import { ProgressClaimGenerator } from "@/components/ProgressClaimGenerator";
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
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const workflowStripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const preferredSuppliers: any[] = (() => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey("preferred_suppliers")) || "[]"); }
    catch { return []; }
  })();

  const handleExportExcel = async () => {
    if (!project) return;

    const projects: any[] = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]"); } catch { return []; } })();
    const lsProject = projects.find((p: any) => p.id === projectId) || {};
    const items: any[] = lsProject.estimate_items || [];
    const consumables: any[] = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey(`cost_estimator_consumables_${projectId}`)) || "[]"); } catch { return []; } })();
    const prefs: any = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey(`cost_estimator_prefs_${projectId}`)) || "{}"); } catch { return {}; } })();
    const brand: any = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey("quote_brand")) || "{}"); } catch { return {}; } })();

    const marginPercent: number = prefs.marginPercent ?? 15;
    const gstEnabled: boolean   = prefs.gstEnabled ?? true;
    const selectedState: string = prefs.selectedState ?? "QLD";

    let totMat = 0, totLab = 0, totFixings = 0;
    const calcItem = (item: any) => {
      const mw = (item.material_wastage_pct ?? 5) / 100;
      const lw = (item.labour_wastage_pct ?? 10) / 100;
      const mat = (item.quantity || 0) * (item.unit_price || 0) * (1 + mw);
      const lab = (item.labour_hours || 0) * (item.labour_rate || 65) * (1 + lw);
      return { mat, lab, line: (mat + lab) * (1 + (item.markup_pct ?? 0) / 100) };
    };
    items.forEach((item: any) => {
      const { mat, lab } = calcItem(item);
      totMat += mat;
      totLab += lab;
      (item.relatedMaterials || []).forEach((rm: any) => { totFixings += (rm.quantity || 0) * (rm.unit_price || rm.unitCost || 0); });
    });
    const totConsumables = consumables.reduce((s: number, c: any) => s + (c.total || 0), 0);
    const subtotal   = totMat + totLab + totFixings + totConsumables;
    const margin     = subtotal * (marginPercent / 100);
    const gst        = (subtotal + margin) * 0.1;
    const grandTotal = subtotal + margin + (gstEnabled ? gst : 0);

    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = brand.companyName || "Metricore";
      wb.created = new Date();

      const ws = wb.addWorksheet("Estimate", { pageSetup: { paperSize: 9, orientation: "landscape" } });

      // 9 columns: # | Description | Area | Unit | Qty | Unit Rate | Mat Total | Lab Total | Line Total
      ws.columns = [
        { key: "num",      width: 4  },
        { key: "desc",     width: 44 },
        { key: "area",     width: 10 },
        { key: "unit",     width: 8  },
        { key: "qty",      width: 8  },
        { key: "unitrate", width: 12 },
        { key: "mattot",   width: 14 },
        { key: "labtot",   width: 14 },
        { key: "linetot",  width: 14 },
      ];

      // Logo — taller placement for better visual weight
      let logoRow = 1;
      if (brand.logo) {
        try {
          const base64 = brand.logo.split(",")[1];
          const ext    = brand.logo.startsWith("data:image/png") ? "png" : "jpeg";
          const imgId  = wb.addImage({ base64, extension: ext as any });
          ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 7 }, editAs: "oneCell" });
          for (let r = 1; r <= 7; r++) ws.getRow(r).height = 22;
          logoRow = 8;
        } catch { logoRow = 1; }
      }

      // Project header block — label in B, value merged C:I
      const addHdr = (label: string, value: string, row: number) => {
        ws.getRow(row).height = 18;
        ws.getCell(`B${row}`).value = label;
        ws.getCell(`B${row}`).font  = { bold: true, size: 10, color: { argb: "FF64748B" } };
        ws.mergeCells(`C${row}:I${row}`);
        ws.getCell(`C${row}`).value = value;
        ws.getCell(`C${row}`).font  = { size: 11, bold: row === logoRow };
      };
      addHdr("Company:",   brand.companyName || "—",                               logoRow);
      addHdr("Project:",   project.name,                                            logoRow + 1);
      addHdr("Client:",    project.client_name || "—",                              logoRow + 2);
      addHdr("Address:",   project.site_address || project.address || "—",         logoRow + 3);
      addHdr("State:",     selectedState,                                            logoRow + 4);
      addHdr("Generated:", new Date().toLocaleDateString("en-AU"),                  logoRow + 5);

      const dataStartRow = logoRow + 7;

      // Column header row
      const hdr = ws.getRow(dataStartRow);
      hdr.height = 20;
      ["#", "Description", "Area", "Unit", "Qty", "Unit Rate", "Mat Total", "Lab Total", "Line Total"].forEach((h, i) => {
        const cell = hdr.getCell(i + 1);
        cell.value = h;
        cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        const align = i === 0 || i === 3 || i === 4 ? "center" : i <= 2 ? "left" : "right";
        cell.alignment = { vertical: "middle", horizontal: align };
      });

      let dataRow = dataStartRow + 1;

      // Group by trade
      const tradeGroups = new Map<string, any[]>();
      items.forEach((item: any) => {
        const t = item.trade || "General";
        if (!tradeGroups.has(t)) tradeGroups.set(t, []);
        tradeGroups.get(t)!.push(item);
      });

      let rowNum = 1;
      tradeGroups.forEach((tradeItems, trade) => {
        // Trade section header
        const tRow = ws.getRow(dataRow);
        tRow.height = 15;
        ws.mergeCells(`A${dataRow}:I${dataRow}`);
        const tCell = tRow.getCell(1);
        tCell.value     = trade.toUpperCase();
        tCell.font      = { bold: true, size: 9, italic: true, color: { argb: "FF334155" } };
        tCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        tCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
        tCell.border    = { left: { style: "medium", color: { argb: "FF64748B" } }, bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
        dataRow++;

        // Item rows — no explicit fill so Excel renders default white (explicit FFFFFFFF was producing black via ExcelJS bug)
        tradeItems.forEach((item: any) => {
          const { mat, lab, line } = calcItem(item);
          const row = ws.getRow(dataRow);
          row.height = 17;
          // # | Description | Area | Unit | Qty | Unit Rate | Mat Total | Lab Total | Line Total
          const vals: (string | number)[] = [
            rowNum++,
            item.scope_of_work || "",
            item.area || "",
            item.unit || "",
            item.quantity || 0,
            item.unit_price || 0,
            Math.round(mat * 100) / 100,
            Math.round(lab * 100) / 100,
            Math.round(line * 100) / 100,
          ];
          vals.forEach((v, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value     = v;
            cell.font      = { size: 10, color: { argb: "FF1E293B" } };
            const align = ci === 0 || ci === 3 || ci === 4 ? "center" : ci <= 2 ? "left" : "right";
            cell.alignment = { vertical: "middle", horizontal: align };
            cell.border    = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
            if (ci >= 5) cell.numFmt = '"$"#,##0.00';
          });
          dataRow++;
        });

        // Gap row between trade groups
        ws.getRow(dataRow).height = 6;
        dataRow++;
      });

      // Consumables section
      if (consumables.length > 0) {
        const cHdrRow = ws.getRow(dataRow);
        cHdrRow.height = 15;
        ws.mergeCells(`A${dataRow}:I${dataRow}`);
        const cHdr = cHdrRow.getCell(1);
        cHdr.value     = "CONSUMABLES";
        cHdr.font      = { bold: true, size: 9, italic: true, color: { argb: "FF334155" } };
        cHdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        cHdr.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
        cHdr.border    = { left: { style: "medium", color: { argb: "FF64748B" } }, bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
        dataRow++;

        consumables.forEach((c: any) => {
          const row = ws.getRow(dataRow);
          row.height = 17;
          ws.mergeCells(`B${dataRow}:C${dataRow}`);
          // Map: A=#empty, B=name(merged B:C), skip C, D=unit, E=qty, F=unitCost, G=0, H=0, I=total
          const colData: [number, string | number][] = [
            [1, ""],
            [2, c.name || ""],
            [4, c.unit || ""],
            [5, c.quantity || 0],
            [6, c.unitCost || 0],
            [7, 0],
            [8, 0],
            [9, c.total || 0],
          ];
          colData.forEach(([colNum, v]) => {
            const cell = row.getCell(colNum);
            cell.value     = v;
            cell.font      = { size: 10, color: { argb: "FF1E293B" } };
            const align = colNum === 1 || colNum === 4 || colNum === 5 ? "center" : colNum === 2 ? "left" : "right";
            cell.alignment = { vertical: "middle", horizontal: align };
            cell.border    = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
            if (colNum >= 6) cell.numFmt = '"$"#,##0.00';
          });
          dataRow++;
        });

        ws.getRow(dataRow).height = 6;
        dataRow++;
      }

      // Summary section
      dataRow++;
      const summaryRows: [string, number][] = [
        ["Materials",                    totMat],
        ["Labour",                       totLab],
        ["Fixings",                      totFixings],
        ["Consumables",                  totConsumables],
        ["Subtotal",                     subtotal],
        [`Margin (${marginPercent}%)`,   margin],
        ...(gstEnabled ? [["GST (10%)", gst] as [string, number]] : []),
        ["GRAND TOTAL",                  grandTotal],
      ];

      summaryRows.forEach(([label, value]) => {
        const isGrand    = label === "GRAND TOTAL";
        const isSubtotal = label === "Subtotal";
        const bgArgb  = isGrand ? "FF1E293B" : isSubtotal ? "FFE2E8F0" : "FFFFFFFF";
        const fgArgb  = isGrand ? "FFFFFFFF" : "FF1E293B";
        ws.mergeCells(`A${dataRow}:G${dataRow}`);
        const lCell = ws.getCell(`A${dataRow}`);
        lCell.value     = label;
        lCell.font      = { bold: isGrand || isSubtotal, size: isGrand ? 12 : 10, color: { argb: fgArgb } };
        lCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        lCell.alignment = { vertical: "middle", horizontal: "right" };
        ws.mergeCells(`H${dataRow}:I${dataRow}`);
        const vCell = ws.getCell(`H${dataRow}`);
        vCell.value     = Math.round(value * 100) / 100;
        vCell.numFmt    = '"$"#,##0.00';
        vCell.font      = { bold: isGrand || isSubtotal, size: isGrand ? 12 : 10, color: { argb: fgArgb } };
        vCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        vCell.alignment = { vertical: "middle", horizontal: "right" };
        ws.getRow(dataRow).height = isGrand ? 22 : 17;
        dataRow++;
      });

      ws.views = [{ state: "frozen", xSplit: 0, ySplit: dataStartRow, activeCell: `A${dataStartRow + 1}` }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = url;
      a.download   = `${project.name.replace(/\s+/g, "_")}_Estimate_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Estimate exported to Excel");
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Excel export failed");
    }
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

  const checkWorkflowScroll = () => {
    const el = workflowStripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkWorkflowScroll();
    window.addEventListener('resize', checkWorkflowScroll);
    return () => window.removeEventListener('resize', checkWorkflowScroll);
  }, []);

  const syncWithTracking = (data: any) => {
    setSyncState('saving');
    syncProjectToSupabase(data);
    const saveTimer = setTimeout(() => setSyncState('saved'), 1000);
    setTimeout(() => setSyncState('idle'), 3500);
    return () => clearTimeout(saveTimer);
  };

  const handleDueDateChange = (date: Date | undefined) => {
    if (!projectId) return;
    setDueDate(date);
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || "[]");
    const idx = projects.findIndex((p: any) => p.id === projectId);
    if (idx !== -1) {
      projects[idx].due_date = date?.toISOString() || null;
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
      syncWithTracking(projects[idx]);
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
      syncWithTracking(projects[idx]);
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
      toast.warning(`Due date was ${Math.abs(daysLeft)} days ago. Consider updating it.`);
    } else if (daysLeft === 0) {
      toast.warning("Due today. Make sure the estimate is complete.");
    } else {
      toast.success(`Reminder set for ${format(dueDate, "PPP")} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} away)`);
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
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              {project && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-[180px] md:max-w-xs">
                    {project.name}
                  </span>
                </>
              )}
              {syncState !== 'idle' && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-2">
                  {syncState === 'saving'
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>
                    : <><Check className="h-3 w-3 text-[#E1DCC9]/80" />Saved</>
                  }
                </span>
              )}
            </div>
            <div className="flex gap-1 md:gap-2 overflow-x-auto scrollbar-none">
              <TourTip text="Start your estimate from a pre-built template: New Build, Bathroom, Kitchen, Deck or Commercial Fitout. Loads all standard line items instantly." position="bottom">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveMainTab("estimate");
                    setTimeout(() => window.dispatchEvent(new Event("open-template-modal")), 100);
                  }}
                  title="Templates"
                >
                  <BookOpen className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Templates</span>
                </Button>
              </TourTip>
              <TourTip text="Generate a branded PDF quote: a 2-page proposal with your logo, scope summary, pricing breakdown and signature block." position="bottom">
                <QuoteGenerator project={project} estimate={estimate} listenForOpen={true} />
              </TourTip>
              <TourTip text="Create a full corporate tender document including company profile, methodology, NCC compliance, programme and legal terms." position="bottom">
                <FullTenderGenerator project={project} estimate={estimate} />
              </TourTip>
              <TourTip text="Download the full estimate as a formatted Excel workbook — trade groupings, material and labour totals, margin, and GST." position="bottom">
                <Button size="sm" variant="outline" onClick={handleExportExcel} className="shrink-0" title="Export to Excel">
                  <FileText className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Export to Excel</span>
                  <span className="md:hidden">Export</span>
                </Button>
              </TourTip>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold">{project.name}</h1>
                {(() => {
                  const statusMap: Record<string, { label: string; pulse: boolean; complete: boolean }> = {
                    in_progress: { label: 'In Progress', pulse: true,  complete: false },
                    active:      { label: 'Active',      pulse: true,  complete: false },
                    complete:    { label: 'Complete',    pulse: false, complete: true  },
                    completed:   { label: 'Complete',    pulse: false, complete: true  },
                    on_hold:     { label: 'On Hold',     pulse: false, complete: false },
                    draft:       { label: 'Draft',       pulse: false, complete: false },
                  };
                  const s = statusMap[project.status ?? ''] ?? { label: project.status || 'Active', pulse: false, complete: false };
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      s.complete ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary'
                    }`}>
                      {s.pulse && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                      )}
                      {s.label}
                    </div>
                  );
                })()}
              </div>
                <TourTip text="Track the quote status: Draft (in progress), Sent (submitted to client), Won or Lost. This feeds your win rate on the dashboard." position="bottom">
                  <Select value={project.quoteStatus || "draft"} onValueChange={handleQuoteStatusChange}>
                    <SelectTrigger className={`h-7 w-auto text-xs px-2.5 border rounded-full ${
                      project.quoteStatus === "won" ? "border-[#E1DCC9]/20 bg-muted/100/10 text-[#E1DCC9]/80" :
                      project.quoteStatus === "lost" ? "border-red-400/50 bg-red-500/10 text-red-400" :
                      project.quoteStatus === "sent" ? "border-border/35 bg-muted/20 text-muted-foreground" :
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
              <div className="text-muted-foreground space-y-1.5 mt-1">
                {project.site_address && (
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="truncate text-sm">{project.site_address}</span>
                  </div>
                )}
                {project.client_name && (
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="truncate text-sm">{project.client_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-sm">{new Date(project.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                    <Button variant="outline" className="justify-start text-left w-full md:w-[240px]">
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
              <TourTip text="Save a reminder for this project's due date. It shows on your dashboard so you never miss a submission." position="left">
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

        {/* ── Row 1: Main workflow steps ── */}
        <div className="flex items-center bg-card border border-border rounded-xl px-6 py-4 mb-2">
          {[
            { key: "takeoff",  label: "Takeoff",  icon: Ruler,      tour: "Upload your PDF plans here. AI measures quantities automatically. Review and adjust each item, then send everything to Estimate." },
            { key: "estimate", label: "Estimate", icon: Calculator,  tour: "Review and price all takeoff items. Add labour, materials, margins and overheads. This is your full cost build-up before generating the client document." },
            { key: "tender",   label: "Pricing",  icon: FileText,    tour: "Generate the final client document. Choose a Quote (fast 2-page branded proposal) or a full Tender with compliance, programme and legal terms." },
          ].map((step, i) => {
            const isActive = activeMainTab === step.key;
            const isPast =
              (step.key === "takeoff"  && (activeMainTab === "estimate" || activeMainTab === "tender")) ||
              (step.key === "estimate" && activeMainTab === "tender");
            return (
              <React.Fragment key={step.key}>
                <TourTip text={step.tour} position="bottom">
                  <button
                    onClick={() => setActiveMainTab(step.key)}
                    className="flex flex-col items-center gap-2 group min-w-0 flex-1"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200 ${
                      isActive
                        ? "bg-primary border-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.3)]"
                        : isPast
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted border-border text-muted-foreground group-hover:border-primary/40"
                    }`}>
                      {isPast ? "✓" : i + 1}
                    </div>
                    <span className={`hidden sm:block text-xs font-semibold tracking-wide transition-colors ${
                      isActive ? "text-primary" : isPast ? "text-primary/70" : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {step.label}
                    </span>
                  </button>
                </TourTip>
                {i < 2 && (
                  <div className={`flex-1 h-px mx-4 transition-colors ${isPast ? "bg-primary/40" : "bg-border"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Row 2: Tools strip (violet active, scrollable on mobile) ── */}
        <div className="relative mb-6">
          {canScrollLeft && (
            <button
              aria-label="Scroll tools left"
              onClick={() => workflowStripRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-6 w-6 flex items-center justify-center rounded-full bg-background border border-border shadow-sm"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          )}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-card to-transparent pointer-events-none rounded-l-xl" />
          )}
          <div
            ref={workflowStripRef}
            onScroll={checkWorkflowScroll}
            className="flex items-center gap-0.5 rounded-xl border border-border bg-card/60 p-1 overflow-x-auto scrollbar-none"
          >
            {[
              { key: "overheads",  label: "Overheads", icon: Settings,     tour: "Add company overheads: insurance, supervision, site costs, preliminaries. These are added on top of your direct estimate costs." },
              { key: "ffe",        label: "FF&E",       icon: Sofa,         tour: "Fixtures, Fittings & Equipment schedule. Enter appliances, furniture and fittings room by room with photos, supplier and pricing. Export as a branded PDF." },
              { key: "insights",   label: "Insights",   icon: TrendingUp,   tour: "AI-generated cost breakdown. Compare your project's rates against current Australian market benchmarks." },
              { key: "compliance", label: "NCC",        icon: ShieldCheck,  tour: "National Construction Code compliance checklist tailored to this project type. Identify gaps before submission." },
              { key: "subbies",    label: "Subbies",    icon: Users,        tour: "Enter and compare subcontractor quotes side by side for each trade. Easily select the best price and attach it to your estimate." },
              { key: "documents",  label: "Docs",       icon: FolderOpen,   tour: "Store all project documents in one place: contracts, variations, site photos, council approvals and correspondence." },
              { key: "schedule",   label: "Schedule",   icon: CalendarIcon, tour: "Auto-generate a Gantt chart from your estimate trades. Adjust durations and dependencies, then print or export." },
              { key: "jobcost",    label: "Job Cost",   icon: BarChart2,    tour: "Track actual costs against your estimate in real time. Log invoices and expenses by trade to see your live margin." },
              { key: "variations",     label: "Variations",   icon: GitBranch,     tour: "Manage change orders with a full approval workflow. Draft, send for approval, track accepted variations and update your contract sum." },
              { key: "progressclaim", label: "Progress Claim", icon: ClipboardList, tour: "Generate SOPA-compliant progress claims with a full breakdown by stage, retention, and GST. Download as a professional PDF." },
            ].map((tool) => {
              const Icon = tool.icon;
              const isActive = activeMainTab === tool.key;
              return (
                <TourTip key={tool.key} text={tool.tour} position="bottom">
                  <button
                    onClick={() => setActiveMainTab(tool.key)}
                    className={`flex items-center gap-1.5 px-2 md:px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      isActive
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-muted-foreground hover:bg-violet-500/10 hover:text-violet-300"
                    }`}
                    title={tool.label}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{tool.label}</span>
                  </button>
                </TourTip>
              );
            })}
          </div>
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-card to-transparent pointer-events-none rounded-r-xl" />
          )}
          {canScrollRight && (
            <button
              aria-label="Scroll tools right"
              onClick={() => workflowStripRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-6 w-6 flex items-center justify-center rounded-full bg-background border border-border shadow-sm"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
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
            <TabsTrigger value="schedule" />
            <TabsTrigger value="jobcost" />
            <TabsTrigger value="variations" />
            <TabsTrigger value="progressclaim" />
          </TabsList>

          {/* Step 1 — PDF Takeoff — forceMount keeps PDF alive when switching to Estimate/Tender */}
          <TabsContent value="takeoff" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <div className="md:hidden flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
              <Monitor className="h-4 w-4 mt-0.5 shrink-0" />
              <p>PDF takeoff works best on a desktop or laptop. The canvas tools are optimised for mouse precision.</p>
            </div>
            <TakeoffErrorBoundary>
              <AIPlanAnalyzerEnhanced key={projectId} projectId={projectId!} estimateId={estimate?.id} />
            </TakeoffErrorBoundary>
          </TabsContent>

          {/* Step 2 — Estimate */}
          <TabsContent value="estimate" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setActiveMainTab("takeoff")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Takeoff
              </Button>
            </div>
            {estimate ? (
              <TakeoffErrorBoundary>
                <EstimateTemplate projectId={projectId!} estimateId={estimate.id} />
              </TakeoffErrorBoundary>
            ) : (
              <Card className="p-6">
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading estimate...</p>
                </div>
              </Card>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveMainTab("tender")}
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Quote
              </Button>
            </div>
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
                <strong>Quote</strong>: fast, branded proposal with scope, pricing and signature block.<br />
                <strong>Tender</strong>: full corporate document with company profile, compliance, methodology, programme and legal terms.
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
            <SubcontractorComparison
              projectId={projectId!}
              onUsePrice={(trade, company, amount) => {
                const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
                const idx = projects.findIndex((p: any) => p.id === projectId);
                const newItem = {
                  id: `subbie-${crypto.randomUUID()}`,
                  section_id: null,
                  area: 'Subcontractor',
                  trade,
                  scope_of_work: `${company} (subcontractor quote)`,
                  material_type: 'Subcontract',
                  quantity: 1,
                  unit: 'lump sum',
                  unit_price: amount,
                  labour_hours: 0,
                  labour_rate: 0,
                  material_wastage_pct: 0,
                  labour_wastage_pct: 0,
                  markup_pct: 0,
                  notes: `Quote from ${company}`,
                  expanded: false,
                };
                if (idx !== -1) {
                  projects[idx].estimate_items = [...(projects[idx].estimate_items || []), newItem];
                } else {
                  projects.push({ id: projectId, estimate_items: [newItem] });
                }
                localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
                const syncTarget = idx !== -1 ? projects[idx] : projects[projects.length - 1];
                if (syncTarget) syncProjectToSupabase(syncTarget);
                window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId } }));
              }}
            />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentLibrary
              projectId={projectId!}
              projectName={project.name}
              clientName={project.client_name}
              siteAddress={project.site_address}
            />
          </TabsContent>


          <TabsContent value="schedule">
            <GanttSchedule projectId={projectId!} />
          </TabsContent>

          <TabsContent value="jobcost">
            <JobCostTracker projectId={projectId!} />
          </TabsContent>

          <TabsContent value="variations">
            <VariationsLog projectId={projectId!} projectName={project?.name ?? ""} clientEmail={project?.client_email} />
          </TabsContent>

          <TabsContent value="progressclaim">
            <ProgressClaimGenerator
              projectName={project?.name ?? ""}
              siteAddress={project?.site_address ?? ""}
              clientName={project?.client_name ?? ""}
              state={project?.state ?? "NSW"}
              contractSum={project?.grand_total ?? 0}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDetail;
