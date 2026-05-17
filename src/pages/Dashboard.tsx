import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, DollarSign, TrendingUp, BarChart3,
  Upload, Zap, Settings, Package, ChevronRight,
  ArrowRight, Clock, User, ExternalLink, AlertTriangle, X, LogOut, Trash2
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_NAMES } from "@/lib/subscription";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { getLocalUser, localSignOut, isSignedIn, getUserStorageKey, migrateUnscopedData } from "@/lib/localAuth";

// ── helpers ─────────────────────────────────────────────────────────────────

type Stage = 'Takeoff' | 'Estimating' | 'Tender Ready' | 'Sent';

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

// ── component ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const sub = useSubscription();
  const localUser = getLocalUser();

  const handleSignOut = () => {
    localSignOut();
    navigate("/");
  };

  useEffect(() => {
    if (!isSignedIn()) {
      navigate("/auth");
      return;
    }
    const user = getLocalUser();
    if (user) migrateUnscopedData(user.email);
    const raw = localStorage.getItem(getUserStorageKey('local_projects'));
    const loaded: any[] = raw ? JSON.parse(raw) : [];
    loaded.sort((a, b) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
    );
    setProjects(loaded);
  }, [navigate]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const defaultRates = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey('default_rates')) || "{}"); } catch { return {}; } })();
  const targetMargin: number = defaultRates.margin ?? 0;

  const pipelineValue = projects.reduce((s, p) => s + getProjectValue(p), 0);
  const sentProjects  = projects.filter(p => getStage(p) === 'Sent');

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
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleNewProject = () => {
    if (atProjectLimit) {
      navigate('/pricing');
      return;
    }
    navigate('/project/new');
  };

  // Show banner: trialing OR expired OR starter hitting project limit
  const showTrialBanner =
    !bannerDismissed &&
    sub.subscription !== null &&
    (sub.isTrialing || sub.isTrialExpired);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30">

      {/* Trial / expiry banner */}
      {showTrialBanner && (
        <div className={`border-b px-6 py-2.5 flex items-center justify-between text-sm ${
          sub.isTrialExpired
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : sub.daysLeftInTrial <= 3
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-primary/10 border-primary/30 text-primary'
        }`}>
          <div className="flex items-center gap-2">
            {sub.isTrialExpired
              ? <><AlertTriangle className="h-4 w-4" /> Your free trial has ended — upgrade to keep full access</>
              : <><Zap className="h-4 w-4" /> Free trial · {sub.daysLeftInTrial} day{sub.daysLeftInTrial !== 1 ? 's' : ''} left · You're on {sub.subscription?.selectedPlan ? PLAN_NAMES[sub.subscription.selectedPlan] : 'Pro'} features</>
            }
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="h-7 text-xs border-current text-current hover:bg-white/10" onClick={() => navigate('/pricing')}>
              {sub.isTrialExpired ? 'Choose a Plan' : 'Upgrade Now'}
            </Button>
            {!sub.isTrialExpired && (
              <button onClick={() => setBannerDismissed(true)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MetricoreLogoMark height={28} />
            <span className="font-display text-xl font-bold">Metricore</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/materials")}>
              <Package className="h-4 w-4 mr-1.5" />Materials
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/insights")}>
              <BarChart3 className="h-4 w-4 mr-1.5" />Insights
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4 mr-1.5" />Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1.5" />Sign Out
            </Button>
            <Button
              size="sm"
              onClick={handleNewProject}
              className={`ml-2 ${atProjectLimit ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
              title={atProjectLimit ? `Plan limit: ${sub.caps.maxProjects} projects — upgrade to add more` : undefined}
            >
              <Plus className="h-4 w-4 mr-1.5" />New Project
              {atProjectLimit && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-current">Limit</Badge>}
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-6">

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
            { label: 'Tenders Sent',       value: String(sentProjects.length),    sub: `of ${projects.length} projects`,   icon: <BarChart3 className="h-4 w-4" />,   accent: 'text-purple-400' },
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

        {/* Pipeline funnel */}
        <Card className="p-5 bg-background">
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
        </Card>

        {/* Recent Projects */}
        <Card className="bg-background">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg font-bold">Recent Projects</h2>
            {projects.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show less' : `Show all ${projects.length}`}
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 px-6">
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
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                <span>Project</span>
                <span>Client</span>
                <span>Stage</span>
                <span>Value</span>
                <span>Modified</span>
                <span></span>
              </div>
              <div className="divide-y divide-border">
                {displayProjects.map((project) => {
                  const stage = getStage(project);
                  const cfg = STAGE_CONFIG[stage];
                  const value = getProjectValue(project);
                  return (
                    <div
                      key={project.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3.5 items-center hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div>
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">{project.name}</div>
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
            },
            {
              icon: <Zap className="h-5 w-5 text-amber-400" />,
              title: 'Quick Estimate',
              desc: 'Manual estimate, no plan needed',
              action: () => atProjectLimit ? navigate('/pricing') : navigate('/project/new?mode=manual'),
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-blue-400" />,
              title: 'Market Insights',
              desc: sub.caps.marketInsights ? 'Current Australian build rates' : 'Pro plan — upgrade to access',
              action: () => sub.caps.marketInsights ? navigate('/insights') : navigate('/pricing'),
            },
            {
              icon: <Package className="h-5 w-5 text-green-400" />,
              title: 'Materials Library',
              desc: 'Supplier catalogue & pricing',
              action: () => navigate('/materials'),
            },
          ].map(({ icon, title, desc, action, primary }) => (
            <Card
              key={title}
              onClick={action}
              className={`p-4 cursor-pointer hover:shadow-md transition-all group ${primary ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-muted rounded-lg">{icon}</div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="font-semibold text-sm mb-1">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
