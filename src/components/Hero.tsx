import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, CheckCircle, Zap } from "lucide-react";
import { isSignedIn } from "@/lib/localAuth";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero opacity-95" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

      {/* Glow blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="max-w-3xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white/90">
              Built for Australian Builders
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            From Plans to
            <span className="block mt-1 bg-gradient-to-r from-primary via-cyan-300 to-white bg-clip-text text-transparent">
              Tenders in Minutes
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-white/65 mb-10 leading-relaxed max-w-2xl mx-auto">
            Measure plans digitally, price by trade, and send professional
            tenders. One tool built for Australian construction.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Button
              size="lg"
              onClick={() => window.location.href = isSignedIn() ? "/dashboard" : "/auth?mode=signup"}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-base md:text-lg px-8 py-6 h-auto font-semibold w-full sm:w-auto"
            >
              Start for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white bg-white/5 hover:bg-white/10 hover:border-white/40 text-base md:text-lg px-8 py-6 h-auto font-semibold w-full sm:w-auto"
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            >
              Watch the Demo
            </Button>
          </div>

          {/* Stats — compact on mobile */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10 max-w-sm sm:max-w-xl mx-auto">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white">10×</div>
              <div className="text-[10px] sm:text-xs text-white/50 mt-0.5 leading-tight">Faster than manual</div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white">26</div>
              <div className="text-[10px] sm:text-xs text-white/50 mt-0.5 leading-tight">Trades covered</div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white">NCC</div>
              <div className="text-[10px] sm:text-xs text-white/50 mt-0.5 leading-tight">Rate references</div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
