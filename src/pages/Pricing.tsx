import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "Forever Free",
      description: "Perfect for small builders getting started",
      features: [
        "Up to 3 active projects",
        "Basic estimate templates",
        "Material price search",
        "Export to PDF",
        "Email support"
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Professional",
      price: "$49",
      period: "per month",
      description: "For growing construction businesses",
      features: [
        "Unlimited projects",
        "AI plan analyzer",
        "Smart material search with AI",
        "Advanced pricing history",
        "Tender generation",
        "Custom branding",
        "Market insights & benchmarking",
        "Priority support",
        "Team collaboration (up to 5 users)"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "Contact sales",
      description: "For large construction firms",
      features: [
        "Everything in Professional",
        "Unlimited team members",
        "Custom integrations",
        "Dedicated account manager",
        "API access",
        "Advanced reporting",
        "Custom training",
        "SLA guarantee",
        "White-label options"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-6 py-12">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/")}
          className="mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="text-center mb-12">
          <h1 className="font-display text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your construction business. All plans include our core estimating features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-16">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`p-8 relative ${
                plan.popular 
                  ? "border-2 border-accent shadow-lg scale-105" 
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-accent text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="font-display text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period !== "Contact sales" && (
                    <span className="text-muted-foreground">/{plan.period.includes("month") ? "mo" : plan.period}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <Button 
                className={`w-full mb-6 ${plan.popular ? "bg-accent hover:bg-accent/90" : ""}`}
                variant={plan.popular ? "default" : "outline"}
                onClick={() => navigate("/auth")}
              >
                {plan.cta}
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="bg-muted/30 rounded-lg p-8 max-w-4xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-4">
            All Plans Include
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-semibold mb-2">✓ Secure Cloud Storage</p>
              <p className="text-muted-foreground">Your data is encrypted and backed up</p>
            </div>
            <div>
              <p className="font-semibold mb-2">✓ Regular Updates</p>
              <p className="text-muted-foreground">New features added monthly</p>
            </div>
            <div>
              <p className="font-semibold mb-2">✓ Australian Focused</p>
              <p className="text-muted-foreground">Built for Aussie construction standards</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Have questions about pricing?</p>
          <Button variant="outline" onClick={() => window.open("mailto:support@esti-mate.com.au", "_blank")}>
            Contact Sales Team
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Pricing;
