import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, X, Shield, Zap, Users,
  FileText, BarChart3, Package, Upload, Calculator,
  Download, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SectionDivider from "@/components/SectionDivider";
import { PLAN_PRICES, PLAN_NAMES, PlanId, TRIAL_DAYS, getSubscriptionStatus } from "@/lib/subscription";
import { isSignedIn } from "@/lib/localAuth";
import { redirectToStripeCheckout } from "@/lib/api/stripe";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";
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
  {
    q: "How does the quantity takeoff work?",
    a: "Upload your PDF architectural plans, set the drawing scale (e.g. 1:100), then draw directly over the plan to measure areas, lengths, and item counts. Metricore also includes automated extraction that reads your plans and identifies quantities across trades, from concrete footings to roof framing, which you can review and push directly into your cost estimate with one click.",
  },
  {
    q: "What types of plans does Metricore support?",
    a: "Any PDF: DA drawings, construction drawings, or concept plans. Plans with a text layer or vector-based content work with automated extraction. Scanned image-only PDFs can still be measured manually by drawing over them. Multi-page plans are fully supported; you can navigate between pages and annotate each one independently.",
  },
  {
    q: "How accurate are the cost estimates?",
    a: "Metricore uses an Australian cost rate database covering 26 trades, with state-based pricing multipliers for QLD, NSW, VIC, WA, SA, ACT, TAS, and NT. Every rate can be overridden with your own figures. Accuracy depends on the precision of your measured quantities. The platform calculates from what you give it, so the closer your takeoff, the closer your estimate.",
  },
  {
    q: "Can I use my own supplier rates?",
    a: "Yes. The Materials Library (Pro plan) lets you save preferred suppliers and materials with your own unit rates. These auto-fill in estimates when you select matching line items, so your pricing reflects your actual cost base rather than industry benchmarks. You can also manually override any rate line by line within an estimate.",
  },
  {
    q: "What does Metricore export?",
    a: "Completed estimates export as a Bill of Quantities in CSV format, professional PDF tender documents ready to send to clients, and Scope of Work PDFs formatted to your business details. All formats include trade breakdowns, quantities, unit rates, labour hours, and totals. Annotated plan PDFs with your measurements marked are also available on the Pro plan.",
  },
  {
    q: "Does it cover all Australian states?",
    a: "Yes. State-based cost multipliers apply to all trade rates, reflecting real market variation between each state and territory. Select your state in the estimate settings and every rate adjusts automatically. You can also set different states on individual projects if you work across multiple markets.",
  },
  {
    q: "What project types does it cover?",
    a: "Residential construction is the primary focus: new homes, extensions, renovations, and fitouts across 26 trades from earthworks and concrete to electrical, plumbing, and landscaping. Custom trades and rates can be added manually for specialist or commercial work. The rate database is calibrated to Australian residential build costs.",
  },
  {
    q: "Is a credit card required for the trial?",
    a: "No. You get 14 days of full access with no card required. Every feature, every export, no restrictions. At the end of the trial you choose a plan to continue, or your account switches to read-only.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes, upgrade or downgrade any time from your account settings. Upgrades take effect immediately. Downgrades apply at the start of your next billing cycle so you keep full access until then.",
  },
  {
    q: "Are prices in AUD?",
    a: "Yes. All prices are in Australian dollars and include GST. Your Stripe invoice will reflect AUD and show the GST component separately.",
  },
  {
    q: "What counts as a project?",
    a: "One construction job — plans, measurements, and an estimate all in one place. Archived projects do not count toward your plan limit. You can archive and unarchive at any time without losing any data.",
  },
  {
    q: "Do you offer refunds?",
    a: "All payments are final. If you have a billing question or issue, contact us at support@metricore.com.au and we will do our best to resolve it.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const Pricing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [selected, setSelected] = useState<PlanId>('pro');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [syncing, setSyncing] = useState(isSignedIn());

  const signedIn = isSignedIn();
  const { isTrialExpired, isTrialing, subscription } = getSubscriptionStatus();
  const alreadyPaid = subscription?.activePlan !== 'trial' && !!subscription?.subscribedAt;

  // Re-sync on mount: signed-in users with active subscriptions redirect to dashboard.
  // Hold render until sync completes to prevent flash of pricing page.
  useEffect(() => {
    if (!signedIn) { setSyncing(false); return; }
    syncSubscriptionFromDB().then(() => {
      const { isTrialExpired: expired } = getSubscriptionStatus();
      if (!expired) { navigate('/dashboard', { replace: true }); return; }
      setSyncing(false);
    }).catch(() => setSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  const saving = (id: PlanId) =>
    Math.round((PLAN_PRICES[id].monthly - PLAN_PRICES[id].annual) * 12);

  const handleCTA = async (planId: PlanId) => {
    if (!signedIn) {
      navigate(`/auth?plan=${planId}&billing=${billing}&mode=signup`);
      return;
    }
    if (checkingOut) return;
    setCheckingOut(true);
    try {
      await redirectToStripeCheckout(planId, billing);
    } catch (err: any) {
      toast.error(err.message ?? "Could not open checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  const handleDirectSubscribe = async (planId: PlanId) => {
    if (signedIn) {
      if (checkingOut) return;
      setCheckingOut(true);
      try {
        await redirectToStripeCheckout(planId, billing);
      } catch (err: any) {
        toast.error(err.message ?? "Could not open checkout. Please try again.");
        setCheckingOut(false);
      }
      return;
    }
    // Not signed in — store direct-checkout intent, then go to signup
    localStorage.setItem('metricore_direct_plan', planId);
    localStorage.setItem('metricore_direct_billing', billing);
    navigate(`/auth?plan=${planId}&billing=${billing}&mode=signup`);
  };

  return (
    <>
      <Helmet>
        <title>Construction Estimation Software Pricing | Metricore</title>
        <meta name="description" content="Simple, transparent pricing for Metricore construction estimation software. Free trial available, no credit card required. Plans for sole traders to mid-size construction firms." />
        <link rel="canonical" href="https://metricore.com.au/pricing" />
        <meta property="og:title" content="Construction Estimation Software Pricing | Metricore" />
        <meta property="og:description" content="Simple, transparent pricing for Metricore. Free trial available, no credit card required. Plans for sole traders to mid-size construction firms." />
        <meta property="og:url" content="https://metricore.com.au/pricing" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Is there a free trial?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. Every new account includes a 14-day free trial with no credit card required. You get full access to the plan you select during signup."
              }
            },
            {
              "@type": "Question",
              "name": "Can I cancel my subscription at any time?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. You can cancel at any time from your account settings. Your access continues until the end of the current billing period."
              }
            },
            {
              "@type": "Question",
              "name": "What is included in the Starter plan?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The Starter plan ($79 AUD/month) includes up to 3 active projects, PDF plan upload, manual quantity measurements, and cost estimation across all trades."
              }
            },
            {
              "@type": "Question",
              "name": "What does the Professional plan include?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The Professional plan ($149 AUD/month) includes unlimited projects, BOQ CSV export, SOW PDF generation, AI Plan Analyser, Market Insights, Materials Library, and full takeoff PDF reports."
              }
            },
            {
              "@type": "Question",
              "name": "Is Metricore available for Australian builders?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. Metricore is built specifically for the Australian construction industry. All rates, trades, and NCC compliance references are tailored for Australian builders, subcontractors, and quantity surveyors."
              }
            },
            {
              "@type": "Question",
              "name": "What file types can I upload?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "You can upload PDF plan sets directly. Metricore renders each page and lets you measure areas, lengths, and counts directly on the plan."
              }
            }
          ]
        })}</script>
      </Helmet>
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-6xl">

        {/* ── Signed-in status banners ── */}
        {alreadyPaid && (
          <div className="mb-8 bg-muted/10 border border-[#E1DCC9]/20 rounded-xl px-5 py-4 text-center text-sm text-[#E1DCC9]/60 dark:text-[#E1DCC9]/80">
            You have an active <strong>{PLAN_NAMES[subscription?.activePlan as PlanId] ?? subscription?.activePlan ?? 'your plan'}</strong> subscription. To change your plan, please contact support.
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
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Choose Your Plan</h1>
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
              <span className="bg-muted/15 text-[#E1DCC9]/70 text-xs rounded-full px-2 py-0.5 font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {PLANS.map(plan => {
            const price = PLAN_PRICES[plan.id][billing];
            const isSelected = selected === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => { if (checkingOut) return; setSelected(plan.id); handleCTA(plan.id); }}
                className={`relative text-left rounded-2xl border-2 p-6 transition-all ${
                  checkingOut ? 'cursor-default opacity-70' : 'cursor-pointer'
                } ${
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

                <h3 className="font-display text-3xl font-bold mb-1">{PLAN_NAMES[plan.id]}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold font-mono">${price}</span>
                  <span className="text-muted-foreground text-sm">AUD/mo</span>
                </div>

                {billing === 'annual' ? (
                  <p className="text-xs text-[#E1DCC9]/80">Save ${saving(plan.id)}/year</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ${PLAN_PRICES[plan.id].annual}/mo if billed annually
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-border space-y-1.5 mb-5">
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
                </div>

                <Button
                  className={`w-full ${
                    isSelected
                      ? 'bg-primary text-[#000000] hover:bg-primary/80 rounded-full font-bold'
                      : 'bg-muted text-foreground hover:bg-primary hover:text-[#000000] hover:rounded-full font-bold'
                  }`}
                  disabled={checkingOut || alreadyPaid}
                  onClick={(e) => { e.stopPropagation(); handleCTA(plan.id); }}
                >
                  {alreadyPaid ? 'Already Subscribed' : 'Start Free Trial'}
                </Button>

                {!alreadyPaid && (
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 text-center"
                    disabled={checkingOut}
                    onClick={(e) => { e.stopPropagation(); handleDirectSubscribe(plan.id); }}
                  >
                    Or subscribe now for ${PLAN_PRICES[plan.id][billing]}/mo
                  </button>
                )}
              </div>
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
                  <Badge variant="outline" className="text-[#E1DCC9]/70 border-[#E1DCC9]/20">Annual · save ${saving(selected)}/yr</Badge>
                )}
              </div>
              <h2 className="font-display text-2xl font-bold mb-1">
                Start your {TRIAL_DAYS}-day free trial
              </h2>
              <p className="text-muted-foreground text-sm">
                ${PLAN_PRICES[selected][billing]} AUD/mo after trial · No credit card required for trial
              </p>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0">
              <Button
                size="lg"
                className="bg-primary text-[#000000] hover:bg-primary/80 rounded-full font-bold px-8"
                disabled={checkingOut || alreadyPaid}
                onClick={() => handleCTA(selected)}
              >
                {checkingOut ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
                ) : alreadyPaid ? (
                  "Already Subscribed"
                ) : signedIn ? (
                  <>Subscribe to {PLAN_NAMES[selected]}</>
                ) : (
                  <>Get Started with {PLAN_NAMES[selected]}</>
                )}
              </Button>
              {!alreadyPaid && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors text-center md:text-right py-1 underline underline-offset-2"
                  disabled={checkingOut}
                  onClick={() => handleDirectSubscribe(selected)}
                >
                  Or subscribe now for ${PLAN_PRICES[selected][billing]}/mo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Full feature comparison ── */}
        <div className="mb-16">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-8">Full Feature Comparison</h2>
          <div className="overflow-x-auto rounded-2xl">
          <div className="rounded-2xl border border-border overflow-hidden min-w-[560px]">
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
                            ? <Check className="h-4 w-4 text-[#E1DCC9]/80" />
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
        </div>

        {/* ── Trust signals ── */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> No credit card for trial</div>
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> 14 days full access</div>
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Australian support team</div>
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
                <>Subscribe to {PLAN_NAMES[selected]}</>
              ) : (
                <>Start Free Trial with {PLAN_NAMES[selected]}</>
              )}
            </Button>
            {!signedIn && (
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
          {!alreadyPaid && (
            <button
              type="button"
              className="mt-4 text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
              disabled={checkingOut}
              onClick={() => handleDirectSubscribe(selected)}
            >
              Or subscribe now — ${PLAN_PRICES[selected][billing]}/mo
            </button>
          )}
        </div>

      </div>
      <SectionDivider />
      <Footer />
    </div>
    </>
  );
};

export default Pricing;
