import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { jobMoney } from '@/lib/xero/money';
import { refreshXeroPayments } from '@/lib/xero/payments';
import { loadProject as loadLocalProject } from '@/lib/contract';
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, FileText, DollarSign, TrendingUp, BarChart3,
  Upload, Zap, Settings, Package, ChevronRight,
  ArrowRight, Clock, User, ExternalLink, AlertTriangle, X, LogOut, Trash2, BookOpen,
  Send, Trophy, XCircle, Users, RefreshCcw, FolderOpen
} from "lucide-react";
import { getMyTeam, getSharedProjects } from "@/lib/db/teams";
import type { Team, SharedProject } from "@/lib/db/teams";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_NAMES } from "@/lib/subscription";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { getLocalUser, localSignOut, isSignedIn, getUserStorageKey, migrateUnscopedData } from "@/lib/localAuth";
import { loadProjectsMerged, deleteProjectFromSupabase, lsSaveProjects, migrateLocalProjectsToSupabase } from "@/lib/db/projects";
import { useTour } from "@/context/TourContext";
import { TourTip } from "@/components/TourTip";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { calculateProjectTotals, resolveProjectPricing } from "@/lib/pricing/estimatePricing";
import { checkEstimate } from "@/lib/estimate/checks";
import { syncProjectToSupabase } from "@/lib/db/projects";
import { STAGE_LABEL, stageOf, stagePatch, stageIndex, type ProjectStage } from "@/lib/projectStage";
import { buildDashboard, nextStep, jobValue } from "@/lib/dashboardData";
import { StagePicker, STAGE_STYLE } from "@/components/dashboard/StagePicker";
import { readUserPricingDefaults } from "@/lib/pricing/userPricingDefaults";
import { SiteVisitsInbox } from "@/components/SiteVisitsInbox";

// ── helpers ─────────────────────────────────────────────────────────────────

// Same total as the Estimate tab's Project Cost Summary (incl. GST): labour, markup,
// overheads, prelims, contingency, margin and GST all come from the shared pricing module.
const getProjectValue = (p: any): number => {
  if (p.estimate_items?.length > 0)
    return calculateProjectTotals(p, readUserPricingDefaults(p)).totalPrice;
  if (p.cost_items?.length > 0)
    return p.cost_items.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0);
  return 0;
};

const fmtCurrency = (n: number) =>
  n === 0 ? '$0' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | undefined) => {
  if (!d) return '—';
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

// ── component ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [stageFilter, setStageFilter] = useState<ProjectStage | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'changed' | 'value' | 'name' | 'stage'>('changed');
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    const user = getLocalUser();
    if (!user) return false;
    return localStorage.getItem(`${user.email}:show_welcome`) === "true";
  });
  const sub = useSubscription();
  const localUser = getLocalUser();
  const { tourEnabled, toggleTour } = useTour();

  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const handleSignOut = async () => {
    await localSignOut();
    navigate("/");
  };

  useEffect(() => {
    if (!isSignedIn()) {
      navigate("/auth");
      return;
    }
    const user = getLocalUser();
    if (user) {
      migrateUnscopedData(user.email);
      // One-time push of existing localStorage projects to Supabase
      migrateLocalProjectsToSupabase(user.email);
    }
    // Load from Supabase (cross-device) merged with localStorage (offline)
    loadProjectsMerged().then(loaded => {
      setProjects(loaded);
      lsSaveProjects(loaded);
      // payments made in Xero since last time: bring them onto the claims shown here
      if (loaded.some((p: any) => (p.progress_claims ?? []).some((c: any) => c.xero))) {
        refreshXeroPayments().then(changed => {
          if (!changed.length) return;
          setProjects(prev => prev.map((p: any) => changed.includes(p.id) ? { ...p, progress_claims: loadLocalProject(p.id)?.progress_claims ?? p.progress_claims } : p));
        }).catch(() => {});
      }
    }).catch(() => {
      setLoadError(true);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [navigate]);

  // Load team projects if user is on Business plan
  useEffect(() => {
    if (sub.effectivePlan !== 'business') return;
    setTeamLoading(true);
    getMyTeam()
      .then(async (team) => {
        setMyTeam(team);
        if (team) {
          const shared = await getSharedProjects(team.id);
          setSharedProjects(shared);
        }
      })
      .catch(() => { /* silently ignore — team section just won't render */ })
      .finally(() => setTeamLoading(false));
  }, [sub.effectivePlan]);

  // ── derived stats ──────────────────────────────────────────────────────────
  // fix-level checks per job (no price, scope not chosen), computed once per load
  const fixCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) {
      if (!(p.estimate_items ?? []).length) { m.set(p.id, 0); continue; }
      try {
        const { config, labourRates } = resolveProjectPricing(p, readUserPricingDefaults(p));
        m.set(p.id, checkEstimate(p.estimate_items, config, labourRates).filter(c => c.level === 'fix').length);
      } catch { m.set(p.id, 0); }
    }
    return m;
  }, [projects]);
  const fixesFor = (p: any) => fixCounts.get(p.id) ?? 0;
  const dash = useMemo(() => buildDashboard(projects, getProjectValue, fixesFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, fixCounts]);

  const q = search.trim().toLowerCase();
  const filteredProjects = projects
    .filter(p => !stageFilter || stageOf(p) === stageFilter)
    .filter(p => !q || [p.name, p.client_name, p.site_address, p.address].some(v => String(v ?? '').toLowerCase().includes(q)))
    .sort((a, b) => sortBy === 'value' ? jobValue(b, getProjectValue) - jobValue(a, getProjectValue)
      : sortBy === 'name' ? String(a.name ?? '').localeCompare(String(b.name ?? ''))
      : sortBy === 'stage' ? stageIndex(stageOf(a)) - stageIndex(stageOf(b))
      : String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
  const displayProjects = showAll ? filteredProjects : filteredProjects.slice(0, 10);

  /** The builder moves a job: saved here and in the cloud, and any suggestion is settled */
  const changeStage = (projectId: string, stage: ProjectStage) => {
    const patch = stagePatch(stage);
    const key = getUserStorageKey('local_projects');
    const all: any[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = all.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(all));
      syncProjectToSupabase(all[idx]);
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
    toast.success(`Moved to ${STAGE_LABEL[stage]}`);
  };
  const dismissSuggestion = (projectId: string) => {
    const key = getUserStorageKey('local_projects');
    const all: any[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = all.findIndex(p => p.id === projectId);
    if (idx !== -1) { all[idx] = { ...all[idx], stage_suggestion: null }; localStorage.setItem(key, JSON.stringify(all)); syncProjectToSupabase(all[idx]); }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, stage_suggestion: null } : p));
  };

  // ── plan guards ────────────────────────────────────────────────────────────
  const atProjectLimit =
    sub.caps.maxProjects !== Infinity && projects.length >= sub.caps.maxProjects;

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const existing: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(existing.filter((p: any) => p.id !== projectId)));
    deleteProjectFromSupabase(projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleNewProject = () => {
    if (atProjectLimit) {
      navigate('/pricing');
      return;
    }
    navigate('/project/new');
  };

  const handleDismissWelcome = () => {
    const user = getLocalUser();
    if (user) localStorage.removeItem(`${user.email}:show_welcome`);
    setShowWelcome(false);
  };

  // Import a shared project as a new local project
  const handleOpenSharedProject = (sp: SharedProject) => {
    const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const imported = {
      ...(sp.project_data as Record<string, unknown>),
      id: newId,
      name: `${sp.project_name} (copy)`,
      created_at: now,
      updated_at: now,
    };
    const key = getUserStorageKey('local_projects');
    const existing: any[] = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([imported, ...existing]));
    navigate(`/project/${newId}`);
  };

  // Trial banner: show from day 1 of trial through expiry
  const showTrialBanner =
    !bannerDismissed &&
    sub.subscription !== null &&
    (sub.isTrialExpired || sub.isTrialing);

  // Past-due banner: payment failed, within 3-day grace period
  const showPastDueBanner = sub.isPastDue;

  // ── render ─────────────────────────────────────────────────────────────────
  // A real name only: the part of an email before the @ is not a name ("yannlb1990")
  // (with no name given at sign-up, displayName falls back to that email prefix)
  const emailPrefix = (localUser?.email ?? "").split("@")[0].toLowerCase();
  const firstName = (localUser?.displayName && !localUser.displayName.includes("@")
    && localUser.displayName.trim().toLowerCase() !== emailPrefix
    ? localUser.displayName.trim().split(/\s+/)[0]
    : "");
  const trialDaysLeft = Math.max(0, sub.daysLeftInTrial ?? 0);

  return (
    <div className="min-h-screen bg-muted/30">

      {showWelcome && (
        <WelcomeOverlay
          firstName={firstName}
          trialDays={trialDaysLeft}
          onDismiss={handleDismissWelcome}
        />
      )}

      {/* Past-due payment banner — amber, always visible during grace period */}
      {showPastDueBanner && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {sub.pastDueGraceDaysLeft > 0
              ? <>Payment failed. Please update your payment method. Access continues for {sub.pastDueGraceDaysLeft} more day{sub.pastDueGraceDaysLeft !== 1 ? 's' : ''}.</>
              : <>Payment overdue. Your grace period has ended. Update your payment method to keep access.</>
            }
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400/60 text-amber-400 hover:bg-amber-500/10" onClick={() => navigate('/settings')}>
            Update Payment
          </Button>
        </div>
      )}

      {/* Trial / expiry banner — 3 urgency tiers */}
      {showTrialBanner && (() => {
        const d = sub.daysLeftInTrial;
        const expired = sub.isTrialExpired;
        const urgent = !expired && d <= 3;
        const warning = !expired && d > 3 && d <= 7;
        const info = !expired && d > 7;
        const colorClass = expired || urgent
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : warning
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400';
        return (
          <div className={`border-b px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm ${colorClass}`}>
            <div className="flex items-center gap-2">
              {expired
                ? <><AlertTriangle className="h-4 w-4 flex-shrink-0" /> Your free trial has ended. Upgrade to keep full access.</>
                : urgent
                ? <><AlertTriangle className="h-4 w-4 flex-shrink-0" /> Trial ends in {d} day{d !== 1 ? 's' : ''}. Upgrade now to keep your projects and data.</>
                : warning
                ? <><Zap className="h-4 w-4 flex-shrink-0" /> {d} days left in your free trial · You have full {sub.subscription?.selectedPlan ? PLAN_NAMES[sub.subscription.selectedPlan] : 'Pro'} access</>
                : <><Zap className="h-4 w-4 flex-shrink-0" /> Free trial · {d} of 14 days remaining · Full {sub.subscription?.selectedPlan ? PLAN_NAMES[sub.subscription.selectedPlan] : 'Pro'} access included</>
              }
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" className="h-7 text-xs border-current text-current hover:bg-white/10" onClick={() => navigate('/pricing')}>
                {expired ? 'Choose a Plan' : 'See Plans'}
              </Button>
              {!expired && (
                <button onClick={() => setBannerDismissed(true)} className="opacity-60 hover:opacity-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Nav */}
      <nav className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MetricoreLogoMark height={28} />
            <span className="font-display text-xl font-bold">Metricore</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="hidden sm:flex items-center gap-1 md:gap-2">
              <TourTip text="Manage your clients and their contact details." position="bottom">
                <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} title="Clients">
                  <Users className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Clients</span>
                </Button>
              </TourTip>
              <TourTip text="Browse supplier materials and update your pricing catalogue." position="bottom">
                <Button variant="ghost" size="sm" onClick={() => navigate("/materials")} title="Materials">
                  <Package className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Materials</span>
                </Button>
              </TourTip>
              <TourTip text="View current Australian build rates, cost trends, and market benchmarks." position="bottom">
                <Button variant="ghost" size="sm" onClick={() => navigate("/insights")} title="Insights">
                  <BarChart3 className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Insights</span>
                </Button>
              </TourTip>
            </div>
            <TourTip text="Manage your company branding, default margins, subscription and account details." position="bottom">
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} title="Settings">
                <Settings className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Settings</span>
              </Button>
            </TourTip>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground" title="Sign Out">
              <LogOut className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Sign Out</span>
            </Button>
            {/* Guide mode toggle — hidden on mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTour}
              className={`hidden md:flex border ${tourEnabled ? 'border-violet-500/60 text-violet-400 bg-violet-500/10' : 'border-border text-muted-foreground'}`}
              title={tourEnabled ? "Turn off Guide Mode" : "Turn on Guide Mode. Hover over buttons to learn what each one does."}
            >
              <BookOpen className="h-4 w-4 mr-1.5" />
              {tourEnabled ? "Guide On" : "Guide"}
            </Button>
            <TourTip text="Start a new estimation project. You can upload a PDF plan or enter manually." position="bottom">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={handleNewProject}
                    className={`ml-1 md:ml-2 ${atProjectLimit ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
                  >
                    <Plus className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">New Project</span>
                    {atProjectLimit && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-current">Limit</Badge>}
                  </Button>
                </TooltipTrigger>
                {atProjectLimit && (
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs font-medium">Project limit reached</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You've used all {sub.caps.maxProjects} project{sub.caps.maxProjects !== 1 ? 's' : ''} on your current plan. Upgrade to Pro for unlimited projects.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TourTip>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8 space-y-6">

        {/* Hero row */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <p className="text-muted-foreground mt-1">
              {projects.length} job{projects.length !== 1 ? 's' : ''}{dash.attention.length ? ` · ${dash.attention.length} need${dash.attention.length === 1 ? 's' : ''} your attention` : ''}
            </p>
          </div>
        </div>

        <SiteVisitsInbox />

        {/* The numbers that matter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {isLoading
            ? [...Array(4)].map((_, i) => (
                <Card key={i} className="p-4 sm:p-5 space-y-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-20" /><Skeleton className="h-3 w-32" /></Card>
              ))
            : [
                { label: 'Quotes out', value: fmtCurrency(dash.quotesOut.value), sub: `${dash.quotesOut.count} with clients`, stage: 'quote_sent' as ProjectStage },
                { label: 'Won this month', value: fmtCurrency(dash.wonThisMonth.value), sub: `${dash.wonThisMonth.count} job${dash.wonThisMonth.count !== 1 ? 's' : ''}`, stage: 'won' as ProjectStage },
                { label: 'Owing to you', value: fmtCurrency(dash.owing.amount), sub: dash.owing.overdue > 0.004 ? `${fmtCurrency(dash.owing.overdue)} overdue` : 'nothing overdue', warn: dash.owing.overdue > 0.004 },
                { label: 'In progress', value: String(dash.inProgress.count), sub: `${fmtCurrency(dash.inProgress.value)} of work`, stage: 'in_progress' as ProjectStage },
              ].map(c => (
                <Card key={c.label} className={`p-4 sm:p-5 ${c.stage ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}`}
                  onClick={() => c.stage && setStageFilter(stageFilter === c.stage ? null : c.stage)}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold">{c.value}</div>
                  <div className={`mt-1 text-xs ${c.warn ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{c.sub}</div>
                </Card>
              ))}
        </div>

        {/* Needs attention: one click to the right screen */}
        {!isLoading && dash.attention.length > 0 && (
          <Card>
            <div className="border-b border-border px-4 md:px-6 py-3">
              <h2 className="font-display text-lg font-bold">Needs attention</h2>
            </div>
            <div className="divide-y divide-border">
              {dash.attention.slice(0, showAllAttention ? undefined : 6).map((a, i) => (
                <div key={`${a.projectId}-${a.kind}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${a.kind === 'overdue' ? 'bg-red-500' : a.kind === 'suggestion' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="font-medium">{a.projectName}</span>
                  <span className="text-muted-foreground">{a.text}</span>
                  <span className="ml-auto flex gap-2">
                    {a.suggestion ? (
                      <>
                        <Button size="sm" className="h-7" onClick={() => changeStage(a.projectId, a.suggestion!)}>Move to {STAGE_LABEL[a.suggestion]}</Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => dismissSuggestion(a.projectId)}>Not yet</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => navigate(`/project/${a.projectId}${a.tab ? `?tab=${a.tab}` : ''}`)}>Open</Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {dash.attention.length > 6 && (
              <button className="w-full border-t border-border py-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAllAttention(v => !v)}>
                {showAllAttention ? 'Show less' : `Show all ${dash.attention.length}`}
              </button>
            )}
          </Card>
        )}

        {(() => { try { return <OnboardingChecklist projects={projects} />; } catch { return null; } })()}

        {/* Load error banner */}
        {loadError && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Could not load projects from the server. Showing locally-saved data.</span>
            <button
              onClick={() => { setLoadError(false); setIsLoading(true); loadProjectsMerged().then(loaded => { setProjects(loaded); lsSaveProjects(loaded); }).catch(() => setLoadError(true)).finally(() => setIsLoading(false)); }}
              className="ml-auto flex items-center gap-1 text-xs underline hover:no-underline shrink-0"
            >
              <RefreshCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Pipeline: every stage, its jobs and their value; click to show those jobs */}
        {projects.length > 0 && (
          <Card className="p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline</p>
              {stageFilter && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setStageFilter(null)}>Show all jobs</button>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dash.pipeline.map(col => {
                const active = stageFilter === col.stage;
                return (
                  <button key={col.stage} type="button" onClick={() => setStageFilter(active ? null : col.stage)}
                    className={`min-w-[118px] flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${STAGE_STYLE[col.stage]} ${active ? 'ring-2 ring-primary' : 'hover:opacity-80'} ${col.count === 0 && !active ? 'opacity-50' : ''}`}>
                    <div className="font-mono text-xl font-bold">{col.count}</div>
                    <div className="text-xs font-medium">{col.label}</div>
                    <div className="mt-0.5 font-mono text-[11px] opacity-80">{col.value > 0 ? fmtCurrency(col.value) : ''}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Jobs */}
        <Card>
          <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b border-border">
            <h2 className="font-display text-lg font-bold">{stageFilter ? STAGE_LABEL[stageFilter] : 'Jobs'}</h2>
            {stageFilter && (
              <button onClick={() => setStageFilter(null)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                Clear <X className="h-3 w-3" />
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, clients, addresses"
                className="h-8 w-56 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="changed">Last changed</option>
                <option value="value">Value</option>
                <option value="name">Name</option>
                <option value="stage">Stage</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 md:px-6 py-4"><Skeleton className="h-4 w-44" /><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="ml-auto h-4 w-16" /></div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 px-4 md:px-6">
              <h3 className="font-semibold text-lg mb-2">No jobs yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Upload a plan or start a quick estimate to get going</p>
              <Button onClick={handleNewProject}><Plus className="h-4 w-4 mr-2" />New project</Button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No jobs match{search ? ` "${search}"` : ''}{stageFilter ? ` in ${STAGE_LABEL[stageFilter]}` : ''}.</p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[2.2fr_1.2fr_1fr_0.9fr_1.3fr_0.7fr_auto] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                <span>Job</span><span>Client</span><span>Stage</span><span>Value</span><span>Next step</span><span>Changed</span><span />
              </div>
              <div className="divide-y divide-border">
                {displayProjects.map((project) => {
                  const stage = stageOf(project);
                  const value = jobValue(project, getProjectValue);
                  const step = nextStep(project, fixesFor(project));
                  const open = (e: React.MouseEvent) => { e.stopPropagation(); navigate(`/project/${project.id}${step.tab ? `?tab=${step.tab}` : ''}`); };
                  const stepBtn = step.label ? (
                    <Button size="sm" variant={step.tone === 'warn' ? 'default' : 'outline'} disabled={step.tone === 'done'}
                      className={`h-7 px-2.5 text-xs ${step.tone === 'warn' ? 'bg-amber-500 text-black hover:bg-amber-400' : ''}`} onClick={open}>
                      {step.label}
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">No further step</span>;
                  return (
                    <div key={project.id} className="group cursor-pointer transition-colors hover:bg-muted/40" onClick={() => navigate(`/project/${project.id}`)}>
                      {/* phone: a card */}
                      <div className="md:hidden px-4 py-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{project.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{[project.client_name, project.site_address].filter(Boolean).join(' · ') || 'No client yet'}</div>
                          </div>
                          {value > 0 && <span className="shrink-0 font-mono text-sm font-semibold">{fmtCurrency(value)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <StagePicker stage={stage} onChange={s => changeStage(project.id, s)} />
                          {stepBtn}
                        </div>
                      </div>
                      {/* computer: a row */}
                      <div className="hidden md:grid grid-cols-[2.2fr_1.2fr_1fr_0.9fr_1.3fr_0.7fr_auto] gap-4 px-6 py-3 items-center">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">{project.name}</div>
                          {project.site_address && <div className="truncate text-xs text-muted-foreground">{project.site_address}</div>}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{project.client_name || '—'}</div>
                        <div><StagePicker stage={stage} onChange={s => changeStage(project.id, s)} /></div>
                        <div className="font-mono text-sm font-medium">{value > 0 ? fmtCurrency(value) : <span className="text-muted-foreground">—</span>}</div>
                        <div>{stepBtn}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(project.updated_at || project.created_at)}</div>
                        <Button size="sm" variant="ghost" title="Delete job"
                          className="h-7 w-7 p-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          onClick={e => handleDeleteProject(e, project.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredProjects.length > 10 && (
                <button className="w-full border-t border-border py-2.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowAll(v => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${filteredProjects.length} jobs`}
                </button>
              )}
            </>
          )}
        </Card>

        {/* Team Projects — Business plan only */}
        {sub.effectivePlan === 'business' && myTeam && (
          <Card className="bg-background">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                <h2 className="font-display text-lg font-bold">Team projects</h2>
                <span className="text-xs text-muted-foreground font-medium">{myTeam.name ?? ''}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/settings/team')} className="text-xs text-muted-foreground">
                Manage team
              </Button>
            </div>
            {teamLoading ? (
              <div className="divide-y divide-border">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-7 w-24 rounded" />
                  </div>
                ))}
              </div>
            ) : sharedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-amber-400/60" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No shared projects yet. Share a project from your estimating workspace.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sharedProjects.map((sp) => (
                  <div key={sp.id} className="flex items-center justify-between px-4 md:px-6 py-3.5 hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="font-medium text-sm">{sp.project_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{sp.created_by.slice(0, 8)}&hellip;</span>
                        <Clock className="h-3 w-3 ml-1" />
                        <span>{fmtDate(sp.created_at)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSharedProject(sp)}
                      className="border-border text-xs hover:bg-muted/30"
                    >
                      Open copy
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              num: '01',
              title: 'New Project',
              desc: atProjectLimit ? `Limit reached (${projects.length}/${sub.caps.maxProjects}). Upgrade to add more.` : 'Upload plans & start measuring',
              action: handleNewProject,
              primary: true,
              tour: 'Upload a PDF plan to extract quantities automatically, or start a manual estimate from scratch.',
            },
            {
              num: '02',
              title: 'Quick Estimate',
              desc: 'Manual estimate, no plan needed',
              action: () => atProjectLimit ? navigate('/pricing') : navigate('/project/new?mode=manual'),
              tour: 'Skip the PDF. Enter rooms and items directly. Great for fast ballpark quotes.',
            },
            {
              num: '03',
              title: 'Market Insights',
              desc: sub.caps.marketInsights ? 'Current Australian build rates' : 'Pro plan. Upgrade to access.',
              action: () => sub.caps.marketInsights ? navigate('/insights') : navigate('/pricing'),
              tour: 'Live Australian construction cost benchmarks. Compare your rates against current market data.',
            },
            {
              num: '04',
              title: 'Materials Library',
              desc: sub.caps.materialsLibrary ? 'Supplier catalogue & pricing' : 'Pro plan. Upgrade to access.',
              action: () => sub.caps.materialsLibrary ? navigate('/materials') : navigate('/pricing'),
              tour: 'Save your preferred suppliers and materials with custom unit rates so they auto-fill in estimates.',
            },
          ].map(({ num, title, desc, action, primary, tour }) => (
            <TourTip key={title} text={tour} position="top">
              <Card
                onClick={action}
                className={`p-4 cursor-pointer hover:shadow-md transition-all group w-full ${primary ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-xs font-semibold text-muted-foreground/50 tracking-widest">{num}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="font-semibold text-sm mb-1">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </Card>
            </TourTip>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
