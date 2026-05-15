import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft, Zap, Shield, Users } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PLAN_PRICES, PLAN_NAMES, PlanId, TRIAL_DAYS } from "@/lib/subscription";

// ── Feature rows for comparison table ────────────────────────────────────────
const FEATURE_ROWS = [
  { label: "Active projects",          starter: "3",       pro: "Unlimited",  business: "Unlimited" },
  { label: "PDF plan upload & takeoff", starter: true,     pro: true,         business: true },
  { label: "Cost estimation (26 trades)", starter: true,   pro: true,         business: true },
  { label: "Overhead management",      starter: true,      pro: true,         business: true },
  { label: "Full tender document",     starter: false,     pro: true,         business: true },
  { label: "BOQ CSV export",           starter: false,     pro: true,         business: true },
  { label: "SOW PDF generation",       starter: false,     pro: true,         business: true },
  { label: "Takeoff PDF report",       starter: false,     pro: true,         business: true },
  { label: "Market Insights",          starter: false,     pro: true,         business: true },
  { label: "Materials library",        starter: false,     pro: true,         business: true },
  { label: "Team seats",               starter: "1",       pro: "1",          business: "5" },
  { label: "Email support",            starter: true,      pro: true,         business: true },
  { label: "Priority support",         starter: false,     pro: false,        business: true },
];

const FAQ = [
  {
    q: "Is a credit card required for the free trial?",
    a: "No. You get full access for 14 days with no credit card required. We'll remind you before the trial ends.",
  },
  {
    q: "What happens when the trial ends?",
    a: "You'll move to the plan you selected at signup. If you don't upgrade, your account switches to read-only until you choose a plan.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes — you can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.",
  },
  {
    q: "Are prices in Australian dollars?",
    a: "Yes. All prices are in AUD and include GST.",
  },
  {
    q: "What is a 'project'?",
    a: "A project is one construction job — it can have multiple plan pages, measurements, and estimates. Completed projects don't count against your limit.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes — contact us within 7 days of your first charge and we'll refund in full, no questions asked.",
  },
];

// ── Plan card data ────────────────────────────────────────────────────────────
const PLANS: Array<{
  id: PlanId;
  tagline: string;
  highlight: string[];
  badge?: string;
  popular?: boolean;
}> = [
  {
    id: "starter",
    tagline: "For tradies and sole operators",
    highlight: [
      "Up to 3 active projects",
      "Full takeoff & measurement tools",
      "Cost estimation across 26 trades",
      "Overhead management",
      "Basic PDF export",
      "Email support",
    ],
  },
  {
    id: "pro",
    tagline: "For builders who win more tenders",
    popular: true,
    badge: "Most Popular",
    highlight: [
      "Unlimited projects",
      "Everything in Starter",
      "BOQ CSV & SOW PDF export",
      "Full tender document generation",
      "Takeoff PDF report",
      "Market Insights & live rates",
      "Materials library",
    ],
  },
  {
    id: "business",
    tagline: "For estimating teams & larger firms",
    highlight: [
      "Everything in Professional",
      "Up to 5 team seats",
      "Priority email support",
      "Early access to new features",
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Pricing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const annualSaving = (id: PlanId) => {
    const saved = (PLAN_PRICES[id].monthly - PLAN_PRICES[id].annual) * 12;
    return Math.round(saved);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-6 pt-28 pb-20">

        {/* Back */}
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Home
        </Button>

        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            <Zap className="h-3 w-3 mr-1.5" />
            {TRIAL_DAYS}-day free trial · No credit card required
          </Badge>
          <h1 className="font-display text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your plan, start a free trial, and send your first professional tender in minutes.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBilling("monthly")}
            className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
              billing === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors ${
              billing === "annual"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            <span className={`text-xs rounded-full px-2 py-0.5 ${
              billing === "annual"
                ? "bg-white/20 text-white"
                : "bg-green-500/15 text-green-600"
            }`}>
              Save 20%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {PLANS.map((plan) => {
            const price = PLAN_PRICES[plan.id][billing];
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col p-8 ${
                  plan.popular
                    ? "border-2 border-primary shadow-xl ring-1 ring-primary/20"
                    : "border-border"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-semibold">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-xl font-bold mb-1">{PLAN_NAMES[plan.id]}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold font-mono">${price}</span>
                    <span className="text-muted-foreground text-sm">AUD / mo</span>
                  </div>
                  {billing === "annual" && (
                    <p className="text-xs text-green-500 mt-1">
                      Save ${annualSaving(plan.id)} / year — billed ${price * 12} annually
                    </p>
                  )}
                  {billing === "monthly" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      or ${PLAN_PRICES[plan.id].annual}/mo billed annually
                    </p>
                  )}
                </div>

                <Button
                  className={`w-full mb-6 ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => navigate(`/auth?plan=${plan.id}&billing=${billing}&mode=signup`)}
                >
                  Start {TRIAL_DAYS}-Day Free Trial
                </Button>

                <ul className="space-y-2.5 flex-1">
                  {plan.highlight.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>No credit card for trial</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>7-day money-back guarantee</span>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="font-display text-3xl font-bold text-center mb-8">Full Feature Comparison</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={`text-center px-4 py-4 font-semibold ${p.popular ? "text-primary" : ""}`}>
                      {PLAN_NAMES[p.id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-6 py-3 text-muted-foreground">{row.label}</td>
                    {(["starter", "pro", "business"] as const).map((planId) => {
                      const val = row[planId];
                      return (
                        <td key={planId} className="text-center px-4 py-3">
                          {typeof val === "boolean" ? (
                            val
                              ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                              : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          ) : (
                            <span className={`font-medium ${planId === "pro" ? "text-primary" : ""}`}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-20">
          <h2 className="font-display text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-medium hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="text-muted-foreground ml-4 shrink-0">{openFaq === i ? "−" : "+"}</span>
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

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Still not sure? Try free for {TRIAL_DAYS} days — no credit card needed.</p>
          <Button size="lg" onClick={() => navigate("/auth?plan=pro&mode=signup")} className="bg-primary text-primary-foreground px-10">
            Start Free Trial
          </Button>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Pricing;
