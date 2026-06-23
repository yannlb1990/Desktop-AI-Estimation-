import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { isSignedIn } from "@/lib/localAuth";

const CTA = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-lg">
            {/* Gradient Background */}
            <div className="absolute inset-0 gradient-primary opacity-95" />

            {/* Content */}
            <div className="relative z-10 px-8 py-16 md:px-16 md:py-20 text-center">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
                Price a job in the time it
                <span className="block mt-1">takes to make a coffee.</span>
              </h2>
              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Australian builders waste 4 to 6 hours on every manual estimate.
                Metricore gets it done in under 30 minutes.
              </p>

              {/* Benefits */}
              <div className="flex flex-wrap justify-center gap-6 mb-10">
                {[
                  "14-day free trial",
                  "No credit card required",
                  "Cancel anytime",
                  "Full feature access",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-white">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span className="font-medium">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                size="lg"
                onClick={() =>
                  window.location.href = isSignedIn()
                    ? "/dashboard"
                    : "/auth?plan=pro&mode=signup"
                }
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow text-lg px-10 py-7 h-auto"
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <p className="mt-5 text-sm text-white/60 font-mono">
                Plans from $79/month · Trusted by builders across QLD, NSW, VIC and WA
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
