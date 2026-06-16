import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, DollarSign, TrendingUp, BarChart3,
  Upload, Zap, Settings, Package, ChevronRight,
  ArrowRight, Clock, User, ExternalLink, AlertTriangle, X, LogOut, Trash2, BookOpen,
  Send, Trophy, XCircle, Users
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_NAMES } from "@/lib/subscription";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { getLocalUser, localSignOut, isSignedIn, getUserStorageKey, migrateUnscopedData } from "@/lib/localAuth";
import { loadProjectsMerged, deleteProjectFromSupabase, lsSaveProjects, migrateLocalProjectsToSupabase } from "@/lib/db/projects";
import { useTour } from "@/context/TourContext";
import { TourTip } from "@/components/TourTip";
import WelcomeOverlay from "@/components/WelcomeOverlay";

// ── helpers ─────────────────────────────────────────────────────────────────

type Stage = 'Takeoff' | 'Estimating' | 'Tender Ready' | 'Sent';
type QuoteStatus = 'draft' | 'sent' | 'won' | 'lost';

const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:  { label: 'Draft',  color: 'text-muted-foreground', bg: 'bg-muted/60 border-border',         icon: <FileText className="h-3 w-3" /> },
  sent:   { label: 'Sent',   color: 'text-purple-400',       bg: 'bg-purple-400/10 border-purple-400/30', icon: <Send className="h-3 w-3" /> },
  won:    { label: 'Won',    color: 'text-green-400',        bg: 'bg-green-400/10 border-green-400/30',  icon: <Trophy className="h-3 w-3" /> },
  lost:   { label: 'Lost',   color: 'text-red-400',          bg: 'bg-red-400/10 border-red-400/30',      icon: <XCircle className="h-3 w-3" /> },
};

const getStage = (p: any): Stage => {
  if (p.status === 'complete' || p.status === 'completed') return 'Sent';
  if (p.estimate_items?.length > 0) return 'Tender Ready';
  if (p.cost_items?.length > 0) return 'Estimating';
  return 'Takeoff';
};

const getProjectValue = (p: any): number => {
  if (p.estimate_items?.length > 0)
    return p.estimate_items.reduce((s: number, i: any) => s + (i.total ?? i.unit_price * i.quantity ?? 0), 0);
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

const STAGE_CONFIG: Record<Stage, { color: string; dot: string; bg: string }> = {
  'Takeoff':      { color: 'text-blue-400',   dot: 'bg-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30' },
  'Estimating':   { color: 'text-amber-400',  dot: 'bg-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30' },
  'Tender Ready': { color: 'text-green-400',  dot: 'bg-green-400',  bg: 'bg-green-400/10 border-green-400/30' },
  'Sent':         { color: 'text-purple-400', dot: 'bg-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
};

// ── Project completion score ─────────────────────────────────────────────────

interface CompletionStep {
  key: string;
  label: string;       // shown in tooltip
  action: string;      // "next step" label shown in UI
  done: boolean;
}

function getProjectCompletion(p: any): {
  steps: CompletionStep[];
  score: number;
  total: number;
  nextAction: string;
  pct: number;
} {
  const hasPlan   = !!(p.plan_file_name || p.plan_file_url);
  const items: any[] = p.estimate_items ?? [];
  const hasItems  = items.length > 0;
  const hasPrices = hasItems && items.some(
    (i: any) => (i.unit_price ?? 0) > 0 || (i.labour_rate ?? 0) > 0 ||
                (i.total ?? 0) > 0 || (i.totalCost ?? 0) > 0
  );
  const grandTotal = (p.grand_total ?? 0) > 0
    ? p.grand_total
    : getProjectValue(p);
  const hasTotals = grandTotal > 0;
  const isSent    = ['sent', 'won', 'lost'].includes(p.quoteStatus ?? '');

  const steps: CompletionStep[] = [
    { key: 'created',  label: 'Project created',   action: 'Created',          done: true },
    { key: 'plan',     label: 'Plan uploaded',      action: 'Upload plan',      done: hasPlan },
    { key: 'items',    label: 'Estimate started',   action: 'Start estimate',   done: hasItems },
    { key: 'priced',   label: 'Items priced',       action: 'Set item pricing', done: hasTotals || hasPrices },
    { key: 'sent',     label: 'Quote sent',         action: 'Send quote',       done: isSent },
  ];

  const score = steps.filter(s => s.done).length;
  const total = steps.length;
  const pct   = Math.round((score / total) * 100);

  const firstPending = steps.find(s => !s.done);
  const nextAction   = firstPending ? firstPending.action : 'Complete';

  return { steps, score, total, nextAction, pct };
}

// ── component ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    const user = getLocalUser();
    if (!user) return false;
    return localStorage.getItem(`${user.email}:show_welcome`) === "true";
  });
  const sub = useSubscription();
  const localUser = getLocalUser();
  const { tourEnabled, toggleTour } = useTour();

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
      // Keep localStorage in sync with what Supabase returned
      lsSaveProjects(loaded);
    });
  }, [navigate]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const defaultRates = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey('default_rates')) || "{}"); } catch { return {}; } })();
  const targetMargin: number = defaultRates.margin ?? 0;

  const pipelineValue = projects.reduce((s, p) => s + getProjectValue(p), 0);
  const sentProjects  = projects.filter(p => getStage(p) === 'Sent');
  const wonProjects   = projects.filter(p => p.quoteStatus === 'won');
  const lostProjects  = projects.filter(p => p.quoteStatus === 'lost');
  const winRate       = (wonProjects.length + lostProjects.length) > 0
    ? Math.round((wonProjects.length / (wonProjects.length + lostProjects.length)) * 100)
    : null;

  const stages: Stage[] = ['Takeoff', 'Estimating', 'Tender Ready', 'Sent'];
  const stageCounts = stages.reduce((acc, s) => {
    acc[s] = projects.filter(p => getStage(p) === s).length;
    return acc;
  }, {} as Record<Stage, number>);

  const displayProjects = showAll ? projects : projects.slice(0, 8);

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

  // Trial banner: show from day 1 of trial through expiry
  const showTrialBanner =
    !bannerDismissed &&
    sub.subscription !== null &&
    (sub.isTrialExpired || sub.isTrialing);

  // Past-due banner: payment failed, within 3-day grace period
  const showPastDueBanner = sub.isPastDue;

  // ── render ─────────────────────────────────────────────────────────────────
  const firstName = (localUser?.displayName ?? localUser?.email ?? "").split(/[\s@]/)[0];
  const trialDaysLeft = sub.daysLeftInTrial > 0 ? sub.daysLeftInTrial : 14;

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
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 text-sm text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {sub.pastDueGraceDaysLeft > 0
              ? <>Payment failed — please update your payment method. Access continues for {sub.pastDueGraceDaysLeft} more day{sub.pastDueGraceDaysLeft !== 1 ? 's' : ''}.</>
              : <>Payment overdue — your grace period has ended. Update your payment method to keep access.</>
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
          : 'bg-blue-500/10 border-blue-500/30 text-blue-400';
        return (
          <div className={`border-b px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 text-sm ${colorClass}`}>
            <div className="flex items-center gap-2">
              {expired
                ? <><AlertTriangle className="h-4 w-4 flex-shrink-0" /> Your free trial has ended — upgrade to keep full access</>
                : urgent
                ? <><AlertTriangle className="h-4 w-4 flex-shrink-0" /> Trial ends in {d} day{d !== 1 ? 's' : ''} — upgrade now to keep your projects and data</>
                : warning
                ? <><Zap className="h-4 w-4 flex-shrink-0" /> {d} days left in your free trial · You have full {sub.subscription?.selectedPlan ? PLAN_NAMES[sub.subscription.selectedPlan] : 'Pro'} access</>
                : <><Zap className="h-4 w-4 flex-shrink-0" /> Free trial — {d} of 14 days remaining · Full {sub.subscription?.selectedPlan ? PLAN_NAMES[sub.subscription.selectedPlan] : 'Pro'} access included</>
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
              title={tourEnabled ? "Turn off Guide Mode" : "Turn on Guide Mode — hover over buttons to learn what they do"}
            >
              <BookOpen className="h-4 w-4 mr-1.5" />
              {tourEnabled ? "Guide On" : "Guide"}
            </Button>
            <TourTip text="Start a new estimation project. You can upload a PDF plan or enter manually." position="bottom">
              <Button
                size="sm"
                onClick={handleNewProject}
                className={`ml-1 md:ml-2 ${atProjectLimit ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
                title={atProjectLimit ? `Plan limit: ${sub.caps.maxProjects} projects — upgrade to add more` : undefined}
              >
                <Plus className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">New Project</span>
                {atProjectLimit && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-current">Limit</Badge>}
              </Button>
            </TourTip>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8 space-y-6">

        {/* Hero row */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome back{localUser ? `, ${localUser.displayName}` : ''}</h1>
            <p className="text-muted-foreground mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''} · {fmtCurrency(pipelineValue)} in pipeline
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects',    value: String(projects.length),        sub: 'all projects',             icon: <FileText className="h-4 w-4" />,    accent: 'text-primary' },
            { label: 'Pipeline Value',     value: fmtCurrency(pipelineValue),     sub: 'across all estimates',     icon: <DollarSign className="h-4 w-4" />,  accent: 'text-green-400' },
            { label: 'Target Margin',      value: targetMargin ? `${targetMargin}%` : '—', sub: targetMargin ? 'set in Settings' : 'set in Settings', icon: <TrendingUp className="h-4 w-4" />, accent: 'text-amber-400' },
            { label: 'Win Rate',     value: winRate !== null ? `${winRate}%` : '—', sub: winRate !== null ? `${wonProjects.length} won · ${lostProjects.length} lost` : 'mark quotes as Won/Lost', icon: <BarChart3 className="h-4 w-4" />, accent: 'text-green-400' },
          ].map(({ label, value, sub, icon, accent }) => (
            <Card key={label} className="p-5 bg-background">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                <span className={accent}>{icon}</span>
              </div>
              <div className="font-mono text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{sub}</div>
            </Card>
          ))}
        </div>

        {/* Pipeline funnel — only shown when there are projects to display */}
        {projects.length > 0 && <Card className="p-5 bg-background">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">Project Pipeline</p>
          <div className="flex items-stretch gap-0">
            {stages.map((stage, i) => {
              const cfg = STAGE_CONFIG[stage];
              const count = stageCounts[stage];
              return (
                <div key={stage} className="flex items-center flex-1">
                  <div className={`flex-1 rounded-lg border px-4 py-3 ${cfg.bg}`}>
                    <div className={`text-2xl font-mono font-bold ${cfg.color}`}>{count}</div>
                    <div className={`text-xs font-medium mt-0.5 ${cfg.color}`}>{stage}</div>
                  </div>
                  {i < stages.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 mx-2 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>}

        {/* Recent Projects */}
        <Card className="bg-background">
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg font-bold">Recent Projects</h2>
            {projects.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show less' : `Show all ${projects.length}`}
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 px-4 md:px-6">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Start by uploading your first plan or creating a quick estimate</p>
              <Button onClick={handleNewProject} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />Create First Project
              </Button>
            </div>
          ) : (
            <>
              {/* Table header — desktop only */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 md:px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                <span>Project</span>
                <span>Client</span>
                <span>Stage</span>
                <span>Status</span>
                <span>Value</span>
                <span>Modified</span>
                <span></span>
              </div>
              <div className="divide-y divide-border">
                {displayProjects.map((project) => {
                  const stage = getStage(project);
                  const cfg = STAGE_CONFIG[stage];
                  const value = getProjectValue(project);
                  const qs = (project.quoteStatus || 'draft') as QuoteStatus;
                  const qcfg = QUOTE_STATUS_CONFIG[qs];
                  const completion = getProjectCompletion(project);
                  const allDone = completion.score === completion.total;
                  return (
                    <div
                      key={project.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      {/* Mobile card layout */}
                      <div className="md:hidden px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm group-hover:text-primary transition-colors truncate">{project.name}</div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {project.client_name && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3 shrink-0" />{project.client_name}
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{stage}
                              </span>
                              {qs !== 'draft' && (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${qcfg.bg} ${qcfg.color}`}>
                                  {qcfg.icon}{qcfg.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1">
                                {completion.steps.map((step, i) => (
                                  <div key={step.key} title={step.label} className={`w-2 h-2 rounded-full transition-colors ${step.done ? i === completion.score - 1 && !allDone ? 'bg-amber-400' : allDone ? 'bg-green-500' : 'bg-primary/60' : 'bg-muted-foreground/20'}`} />
                                ))}
                              </div>
                              {value > 0 && <span className="font-mono text-sm font-semibold text-primary">{fmtCurrency(value)}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={e => handleDeleteProject(e, project.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop table row */}
                      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3.5 items-center">
                        <div>
                          <div className="font-medium text-sm group-hover:text-primary transition-colors">{project.name}</div>
                          <div className="flex items-center gap-1 mt-1.5">
                            {completion.steps.map((step, i) => (
                              <div
                                key={step.key}
                                title={step.label}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  step.done
                                    ? i === completion.score - 1 && !allDone
                                      ? 'bg-amber-400'
                                      : allDone
                                      ? 'bg-green-500'
                                      : 'bg-primary/60'
                                    : 'bg-muted-foreground/20'
                                }`}
                              />
                            ))}
                            <span className={`text-xs ml-1 ${allDone ? 'text-green-500' : 'text-muted-foreground/60'}`}>
                              {allDone ? '✓ Complete' : <span>→ {completion.nextAction}</span>}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{project.client_name || '—'}</span>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {stage}
                          </span>
                        </div>
                        <div>
                          {qs !== 'draft' && (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${qcfg.bg} ${qcfg.color}`}>
                              {qcfg.icon}
                              {qcfg.label}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm font-medium">
                          {value > 0 ? fmtCurrency(value) : <span className="text-muted-foreground">—</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {fmtDate(project.updated_at || project.created_at)}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={e => { e.stopPropagation(); navigate(`/project/${project.id}`); }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={e => handleDeleteProject(e, project.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: <Upload className="h-5 w-5 text-primary" />,
              title: 'New Project',
              desc: atProjectLimit ? `Limit reached (${projects.length}/${sub.caps.maxProjects}) — upgrade` : 'Upload plans & start measuring',
              action: handleNewProject,
              primary: true,
              tour: 'Upload a PDF plan and let AI detect your takeoff quantities, or start a manual estimate from scratch.',
            },
            {
              icon: <Zap className="h-5 w-5 text-amber-400" />,
              title: 'Quick Estimate',
              desc: 'Manual estimate, no plan needed',
              action: () => atProjectLimit ? navigate('/pricing') : navigate('/project/new?mode=manual'),
              tour: 'Skip the PDF — enter rooms and items directly. Great for fast ballpark quotes.',
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-blue-400" />,
              title: 'Market Insights',
              desc: sub.caps.marketInsights ? 'Current Australian build rates' : 'Pro plan — upgrade to access',
              action: () => sub.caps.marketInsights ? navigate('/insights') : navigate('/pricing'),
              tour: 'Live Australian construction cost benchmarks — compare your rates against current market data.',
            },
            {
              icon: <Package className="h-5 w-5 text-green-400" />,
              title: 'Materials Library',
              desc: 'Supplier catalogue & pricing',
              action: () => navigate('/materials'),
              tour: 'Save your favourite suppliers and materials with custom unit rates so they auto-fill in estimates.',
            },
          ].map(({ icon, title, desc, action, primary, tour }) => (
            <TourTip key={title} text={tour} position="top">
              <Card
                onClick={action}
                className={`p-4 cursor-pointer hover:shadow-md transition-all group w-full ${primary ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-muted rounded-lg">{icon}</div>
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
