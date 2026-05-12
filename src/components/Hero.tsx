import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Zap, FileCheck } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero opacity-95" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

      {/* Cyan glow blob — top-right */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8 animate-fade-in">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white/90">
              Powered by AI · Built for Australian Builders
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight animate-fade-in">
            From Plans to Tenders in
            {/* Gradient: cyan → white — always visible on dark background */}
            <span className="block mt-2 bg-gradient-to-r from-primary via-cyan-300 to-white bg-clip-text text-transparent">
              Minutes, Not Days
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-white/75 mb-12 max-w-2xl mx-auto animate-fade-in">
            AI-powered construction estimation that automatically generates takeoffs,
            pricing, and professional tenders from your drawings.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-in">
            {/* Primary — solid cyan */}
            <Button
              size="lg"
              onClick={() => window.location.href = "/dashboard"}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-lg px-8 py-6 h-auto font-semibold"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            {/* Secondary — white outlined ghost */}
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/5 hover:bg-white/10 hover:border-white/50 text-lg px-8 py-6 h-auto font-semibold"
              onClick={() => {
                const el = document.getElementById("features");
                el ? el.scrollIntoView({ behavior: "smooth" }) : window.location.href = "/auth";
              }}
            >
              Watch Demo
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto animate-fade-in">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-primary mb-2" />
              <div className="font-mono text-3xl font-bold text-white">98%</div>
              <div className="text-sm text-white/60">Takeoff Accuracy</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap className="h-8 w-8 text-primary mb-2" />
              <div className="font-mono text-3xl font-bold text-white">10x</div>
              <div className="text-sm text-white/60">Faster Estimates</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FileCheck className="h-8 w-8 text-primary mb-2" />
              <div className="font-mono text-3xl font-bold text-white">100%</div>
              <div className="text-sm text-white/60">NCC Compliant</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into page */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
