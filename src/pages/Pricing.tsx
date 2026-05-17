import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, X, ArrowRight, Shield, Zap, Users,
  FileText, BarChart3, Package, Upload, Calculator,
  Download, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PLAN_PRICES, PLAN_NAMES, PlanId, TRIAL_DAYS, getSubscriptionStatus } from "@/lib/subscription";
import { isSignedIn } from "@/lib/localAuth";
import { redirectToStripeCheckout } from "@/lib/stripeCheckout";
import { toast } from "sonner";

// ── Plan definitions ──────────────────────────────────────────────────────────

type FeatureKey =
  | 'projects' | 'takeoff' | 'estimation' | 'overheads'
  | 'tenderDoc' | 'boqCsv' | 'sowPdf' | 'pdfReport'
  | 'marketInsights' | 'materialsLib' | 'teamSeats' | 'support';

interface PlanDef {
  id: PlanId;
  tagline: string;
  popular?: boolean;
  color: string;
  icon: React.ReactNode;
  features: Record<FeatureKey, string | boolean>;
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    tagline: 'For sole traders & small subbies',
    color: 'border-border',
    icon: <Upload className="h-5 w-5" />,
    features: {
      projects:       '3 active projects',
      takeoff:        true,
      estimation:     true,
      overheads:      true,
      tenderDoc:      false,
      boqCsv:         false,
      sowPdf:         false,
      pdfReport:      false,
      marketInsights: false,
      materialsLib:   false,
      teamSeats:      '1 user',
      support:        'Email support',
    },
  },
  {
    id: 'pro',
    tagline: 'For builders who win more tenders',
    popular: true,
    color: 'border-primary',
    icon: <Zap className="h-5 w-5" />,
    features: {
      projects:       'Unlimited projects',
      takeoff:        true,
      estimation:     true,
      overheads:      true,
      tenderDoc:      true,
      boqCsv:         true,
      sowPdf:         true,
      pdfReport:      true,
      marketInsights: true,
      materialsLib:   true,
      teamSeats:      '1 user',
      support:        'Priority email support',
    },
  },
  {
    id: 'business',
    tagline: 'For estimating teams & larger firms',
    color: 'border-border',
    icon: <Users className="h-5 w-5" />,
    features: {
      projects:       'Unlimited projects',
      takeoff:        true,
      estimation:     true,
      overheads:      true,
      tenderDoc:      true,
      boqCsv:         true,
      sowPdf:         true,
      pdfReport:      true,
      marketInsights: true,
      materialsLib:   true,
      teamSeats:      'Up to 5 users',
      support:        'Priority email + phone support',
    },
  },
];

// ── Feature labels ────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<FeatureKey, { label: string; icon: React.ReactNode; desc: string }> = {
  projects:       { label: 'Active Projects',       icon: <FileText className="h-4 w-4" />,    desc: 'How many live projects you can manage at once' },
  takeoff:        { label: 'PDF Takeoff & Measuring', icon: <Upload className="h-4 w-4" />,      desc: 'Upload plans and measure areas, lengths and counts' },
  estimation:     { label: 'Cost Estimation (26 trades)', icon: <Calculator className="h-4 w-4" />, desc: 'Full labour + materials costing across all trades' },
  overheads:      { label: 'Overhead Management',   icon: <Calculator className="h-4 w-4" />,  desc: 'Site costs, insurance, equipment and preliminaries' },
  tenderDoc:      { label: 'Full Tender Document',  icon: <FileText className="h-4 w-4" />,    desc: 'Professional branded tender ready to send to clients' },
  boqCsv:         { label: 'BOQ CSV Export',        icon: <Download className="h-4 w-4" />,    desc: 'Bill of Quantities in Excel-compatible CSV format' },
  sowPdf:         { label: 'Scope of Work PDF',     icon: <Download className="h-4 w-4" />,    desc: 'Auto-generated SOW document from your cost items' },
  pdfReport:      { label: 'Takeoff PDF Report',    icon: <Download className="h-4 w-4" />,    desc: 'Annotated plan report with all measurements labelled' },
  marketInsights: { label: 'Market Insights',       icon: <BarChart3 className="h-4 w-4" />,   desc: 'Live Australian material & labour rate benchmarks' },
  materialsLib:   { label: 'Materials Library',     icon: <Package className="h-4 w-4" />,     desc: 'Supplier catalogue with Bunnings, Reece, Mitre 10 pricing' },
  teamSeats:      { label: 'Team Seats',            icon: <Users className="h-4 w-4" />,       desc: 'Number of user accounts on your subscription' },
  support:        { label: 'Support',               icon: <Shield className="h-4 w-4" />,      desc: 'How we help you when something goes wrong' },
};

const FAQ = [
  { q: "Is a credit card required for the trial?", a: "No. You get 14 days of full access with no card required." },
  { q: "What happens when the trial ends?", a: "You move onto the plan you selected. If you don't upgrade, your account switches to read-only until you choose a plan." },
  { q: "Can I switch plans?", a: "Yes — upgrade or downgrade any time. Upgrades apply immediately; downgrades apply at the next billing cycle." },
  { q: "Are prices in AUD?", a: "Yes. All prices are in Australian dollars and include GST." },
  { q: "What counts as a 'project'?", a: "One construction job with plans, measurements and an estimate. Archived projects don't count toward your limit." },
  { q: "Do you offer refunds?", a: "Yes — contact us within 7 days of your first charge for a full refund, no questions asked." },
];

// ── Component ─────────────────────────────────────────────────────────────────

const Pricing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [selected, setSelected] = useState<PlanId>('pro');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const signedIn = isSignedIn();
  const { isTrialExpired, isTrialing, subscription } = getSubscriptionStatus();
  const alreadyPaid = subscription?.activePlan !== 'trial' && !!subscription?.subscribedAt;

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  const saving = (id: PlanId) =>
    Math.round((PLAN_PRICES[id].monthly - PLAN_PRICES[id].annual) * 12);

  const handleCTA = async (planId: PlanId) => {
    if (!signedIn) {
      navigate(`/auth?plan=${planId}&billing=${billing}&mode=signup`);
      return;
    }
    // Signed in → go to Stripe
    setCheckingOut(true);
    try {
      await redirectToStripeCheckout(planId, billing);
    } catch (err: any) {
      toast.error(err.message ?? "Could not open checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-6xl">

        {/* ── Signed-in status banners ── */}
        {alreadyPaid && (
          <div className="mb-8 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 text-center text-sm text-green-700 dark:text-green-400">
            You have an active <strong>{PLAN_NAMES[subscription!.activePlan as PlanId]}</strong> subscription. To change your plan, please contact support.
          </div>
        )}
        {!alreadyPaid && isTrialExpired && signedIn && (
          <div className="mb-8 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-4 text-center text-sm text-destructive">
            Your 14-day trial has ended. Subscribe below to regain full access.
          </div>
        )}
        {!alreadyPaid && isTrialing && signedIn && (
          <div className="mb-8 bg-primary/10 border border-primary/30 rounded-xl px-5 py-4 text-center text-sm text-primary">
            Your trial is active. Subscribe now to lock in your plan before it expires.
          </div>
        )}

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 text-sm px-3 py-1">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {TRIAL_DAYS}-day free trial · No credit card required
          </Badge>
          <h1 className="font-display text-5xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Start your free trial today. Pick a plan that fits your business and upgrade or downgrade anytime.
          </p>
        </div>

        {/* ── Billing toggle ── */}
        <div className="flex items-center justify-center mb-10">
          <div className="inline-flex items-center gap-1 bg-muted rounded-full p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === 'monthly' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === 'annual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <span className="bg-green-500/15 text-green-600 text-xs rounded-full px-2 py-0.5 font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {PLANS.map(plan => {
            const price = PLAN_PRICES[plan.id][billing];
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`relative text-left rounded-2xl border-2 p-6 transition-all focus:outline-none ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Selected indicator */}
                <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                  isSelected ? 'border-primary bg-primary' : 'border-border'
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {plan.icon}
                </div>

                <h3 className="font-display text-xl font-bold mb-1">{PLAN_NAMES[plan.id]}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold font-mono">${price}</span>
                  <span className="text-muted-foreground text-sm">AUD/mo</span>
                </div>

                {billing === 'annual' ? (
                  <p className="text-xs text-green-500">Save ${saving(plan.id)}/year</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ${PLAN_PRICES[plan.id].annual}/mo if billed annually
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                  {(Object.keys(FEATURE_LABELS) as FeatureKey[]).slice(0, 5).map(key => {
                    const val = plan.features[key];
                    if (typeof val === 'boolean' && !val) return null;
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-muted-foreground">
                          {typeof val === 'string' ? val : FEATURE_LABELS[key].label}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-primary font-medium pt-1">
                    {isSelected ? '← Selected' : 'Click to select'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Selected plan CTA panel ── */}
        <div className="bg-primary/5 border-2 border-primary/30 rounded-2xl p-6 md:p-8 mb-12 transition-all">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary text-primary-foreground">{PLAN_NAMES[selected]}</Badge>
                {billing === 'annual' && (
                  <Badge variant="outline" className="text-green-600 border-green-500/30">Annual — save ${saving(selected)}/yr</Badge>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold mb-1">
                Start your {TRIAL_DAYS}-day free trial
              </h2>
              <p className="text-muted-foreground text-sm">
                ${PLAN_PRICES[selected][billing]} AUD/mo after trial · Cancel any time · No credit card required
              </p>
            </div>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 shrink-0"
              disabled={checkingOut || alreadyPaid}
              onClick={() => handleCTA(selected)}
            >
              {checkingOut ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
              ) : alreadyPaid ? (
                "Already Subscribed"
              ) : signedIn ? (
                <>Subscribe to {PLAN_NAMES[selected]} <ArrowRight className="ml-2 h-5 w-5" /></>
              ) : (
                <>Get Started with {PLAN_NAMES[selected]} <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </div>
        </div>

        {/* ── Full feature comparison ── */}
        <div className="mb-16">
          <h2 className="font-display text-3xl font-bold text-center mb-8">Full Feature Comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-border bg-muted/40">
              <div className="px-6 py-4 text-sm font-semibold text-muted-foreground">Feature</div>
              {PLANS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`px-4 py-4 text-center text-sm font-bold transition-colors ${
                    selected === p.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {PLAN_NAMES[p.id]}
                  {selected === p.id && <div className="h-0.5 bg-primary rounded-full mt-1 mx-auto w-8" />}
                </button>
              ))}
            </div>

            {/* Rows */}
            {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key, i) => {
              const { label, icon, desc } = FEATURE_LABELS[key];
              return (
                <div key={key} className={`grid grid-cols-4 border-b border-border/50 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                  <div className="px-6 py-3.5 flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground hidden md:block">{desc}</div>
                    </div>
                  </div>
                  {PLANS.map(plan => {
                    const val = plan.features[key];
                    const isSelPlan = selected === plan.id;
                    return (
                      <div key={plan.id} className={`px-4 py-3.5 flex items-center justify-center ${isSelPlan ? 'bg-primary/5' : ''}`}>
                        {typeof val === 'boolean' ? (
                          val
                            ? <Check className="h-4 w-4 text-green-500" />
                            : <X className="h-4 w-4 text-muted-foreground/30" />
                        ) : (
                          <span className={`text-sm font-medium text-center ${isSelPlan ? 'text-primary' : 'text-foreground'}`}>
                            {val}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* CTA row */}
            <div className="grid grid-cols-4 bg-muted/20">
              <div className="px-6 py-4" />
              {PLANS.map(plan => (
                <div key={plan.id} className={`px-4 py-4 flex justify-center ${selected === plan.id ? 'bg-primary/5' : ''}`}>
                  <Button
                    size="sm"
                    variant={selected === plan.id ? 'default' : 'outline'}
                    className={selected === plan.id ? 'bg-primary text-primary-foreground' : ''}
                    disabled={checkingOut}
                    onClick={() => handleCTA(plan.id)}
                  >
                    {selected === plan.id
                      ? (signedIn ? 'Subscribe' : 'Start Trial')
                      : 'Select'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Trust signals ── */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> No credit card for trial</div>
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Cancel anytime</div>
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> 7-day money-back guarantee</div>
          <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Built for Australian builders</div>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold text-center mb-8">Questions & Answers</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-medium hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground border-t border-border/50 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="text-center bg-muted/30 rounded-2xl p-10">
          <h2 className="font-display text-3xl font-bold mb-3">Ready to save hours on every tender?</h2>
          <p className="text-muted-foreground mb-6">
            {TRIAL_DAYS} days free. No credit card. Cancel whenever.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground px-10"
              disabled={checkingOut || alreadyPaid}
              onClick={() => handleCTA(selected)}
            >
              {checkingOut ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
              ) : alreadyPaid ? (
                "Already Subscribed"
              ) : signedIn ? (
                <>Subscribe — {PLAN_NAMES[selected]} <ArrowRight className="ml-2 h-5 w-5" /></>
              ) : (
                <>Start Free Trial with {PLAN_NAMES[selected]} <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
            {!signedIn && (
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Pricing;
