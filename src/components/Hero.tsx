import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, CheckCircle, Users, Zap } from "lucide-react";

const AppMockup = () => (
  <div className="relative w-full max-w-lg mx-auto">
    {/* Glow behind mockup */}
    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-3xl scale-110 pointer-events-none" />

    {/* Browser chrome */}
    <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#0f1117]">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d27] border-b border-white/10">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-amber-500/70" />
          <span className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 mx-3 bg-[#0f1117] rounded-md px-3 py-1 text-[10px] text-white/30 truncate">
          estimationapp-kappa.vercel.app/project/1
        </div>
      </div>

      {/* App UI */}
      <div className="flex h-[340px] text-[10px]">

        {/* Left toolbar */}
        <div className="w-10 bg-[#131620] border-r border-white/5 flex flex-col items-center py-3 gap-3">
          {["M", "L", "A", "⊙", "↔"].map((t, i) => (
            <div key={i} className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[9px] ${i === 1 ? 'bg-primary text-black' : 'text-white/30 hover:text-white/60'}`}>{t}</div>
          ))}
        </div>

        {/* Canvas area */}
        <div className="flex-1 bg-[#0d0f18] relative overflow-hidden">

          {/* Floor plan SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
            {/* Floor plan outline */}
            <rect x="30" y="20" width="240" height="220" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            {/* Internal walls */}
            <line x1="150" y1="20" x2="150" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="30" y1="140" x2="270" y2="140" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="150" y1="140" x2="150" y2="240" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            {/* Door openings */}
            <path d="M 30 80 Q 30 60 50 60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <path d="M 150 170 Q 130 170 130 150" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* Measurement line — horizontal top room */}
            <line x1="30" y1="10" x2="150" y2="10" stroke="#22d3ee" strokeWidth="1" />
            <line x1="30" y1="7" x2="30" y2="13" stroke="#22d3ee" strokeWidth="1" />
            <line x1="150" y1="7" x2="150" y2="13" stroke="#22d3ee" strokeWidth="1" />
            <text x="90" y="8" fill="#22d3ee" fontSize="6" textAnchor="middle" fontFamily="monospace">8.40 m</text>

            {/* Measurement line — right wall */}
            <line x1="278" y1="20" x2="278" y2="240" stroke="#22d3ee" strokeWidth="1" />
            <line x1="275" y1="20" x2="281" y2="20" stroke="#22d3ee" strokeWidth="1" />
            <line x1="275" y1="240" x2="281" y2="240" stroke="#22d3ee" strokeWidth="1" />
            <text x="290" y="135" fill="#22d3ee" fontSize="6" textAnchor="middle" fontFamily="monospace" transform="rotate(90, 290, 135)">14.60 m</text>

            {/* Area fill — top-left room */}
            <rect x="31" y="21" width="118" height="118" fill="#22d3ee" fillOpacity="0.06" />
            <text x="90" y="85" fill="#22d3ee" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="bold">Living Room</text>
            <text x="90" y="96" fill="#22d3ee" fontSize="6" textAnchor="middle" fontFamily="monospace">45.8 m²</text>

            {/* Area fill — top-right room */}
            <rect x="151" y="21" width="118" height="118" fill="#a78bfa" fillOpacity="0.06" />
            <text x="210" y="85" fill="#a78bfa" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="bold">Master Bed</text>
            <text x="210" y="96" fill="#a78bfa" fontSize="6" textAnchor="middle" fontFamily="monospace">22.4 m²</text>

            {/* Area fill — bottom rooms */}
            <rect x="31" y="141" width="118" height="98" fill="#34d399" fillOpacity="0.05" />
            <text x="90" y="193" fill="#34d399" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="bold">Kitchen</text>
            <text x="90" y="204" fill="#34d399" fontSize="6" textAnchor="middle" fontFamily="monospace">18.2 m²</text>

            <rect x="151" y="141" width="118" height="98" fill="#fb923c" fillOpacity="0.05" />
            <text x="210" y="193" fill="#fb923c" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="bold">Garage</text>
            <text x="210" y="204" fill="#fb923c" fontSize="6" textAnchor="middle" fontFamily="monospace">28.0 m²</text>
          </svg>

          {/* Scale badge */}
          <div className="absolute top-2 right-2 bg-green-500/20 border border-green-500/40 rounded px-2 py-0.5 text-[9px] text-green-400 font-mono">
            ✓ Scale 1:100
          </div>
        </div>

        {/* Right measurements panel */}
        <div className="w-28 bg-[#131620] border-l border-white/5 p-2 space-y-1.5 overflow-hidden">
          <div className="text-[9px] text-white/40 uppercase tracking-wide mb-2">Measurements</div>
          {[
            { label: "Living Room", val: "45.8 m²", color: "bg-primary/30 text-primary" },
            { label: "Master Bed", val: "22.4 m²", color: "bg-violet-400/30 text-violet-400" },
            { label: "Kitchen", val: "18.2 m²", color: "bg-green-400/30 text-green-400" },
            { label: "Garage", val: "28.0 m²", color: "bg-orange-400/30 text-orange-400" },
            { label: "Total Wall", val: "94.6 m", color: "bg-blue-400/30 text-blue-400" },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white/5 rounded p-1.5">
              <div className="text-white/50 text-[8px] truncate">{label}</div>
              <div className={`text-[9px] font-mono font-bold rounded px-1 mt-0.5 inline-block ${color}`}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1d27] border-t border-white/5 text-[9px] text-white/30">
        <span>4 measurements · 114.4 m² total</span>
        <span className="text-primary font-mono">1:100 · Line tool</span>
      </div>
    </div>

    {/* Floating cost card */}
    <div className="absolute -bottom-4 -right-4 bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-[9px] text-white/50 mb-0.5">Estimated Value</div>
      <div className="text-base font-mono font-bold text-green-400">$284,500</div>
      <div className="text-[9px] text-white/40">42% margin · ready to send</div>
    </div>
  </div>
);

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero opacity-95" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

      {/* Glow blob */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 py-16 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* ── Left column: text ── */}
          <div className="flex-1 max-w-xl text-center lg:text-left">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-white/90">
                Built for Australian Builders
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              From Plans to
              <span className="block mt-1 bg-gradient-to-r from-primary via-cyan-300 to-white bg-clip-text text-transparent">
                Tenders in Minutes
              </span>
            </h1>

            {/* Description — honest about what the tool does */}
            <p className="text-lg md:text-xl text-white/70 mb-8 leading-relaxed">
              Measure plans digitally, price by trade, and send professional
              tenders — all in one tool designed for Australian construction.
              No guesswork, no spreadsheets.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Button
                size="lg"
                onClick={() => window.location.href = "/dashboard"}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-lg px-8 py-6 h-auto font-semibold"
              >
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 text-white bg-white/5 hover:bg-white/10 hover:border-white/40 text-lg px-8 py-6 h-auto font-semibold"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                See How It Works
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-2 justify-center lg:justify-start text-sm text-white/50 mb-10">
              <Users className="h-4 w-4" />
              <span>Trusted by subcontractors &amp; builders across Australia</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div className="text-center lg:text-left">
                <div className="flex items-center gap-1 justify-center lg:justify-start mb-1">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">10×</div>
                <div className="text-xs text-white/50 mt-0.5">Faster than manual</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center gap-1 justify-center lg:justify-start mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">26</div>
                <div className="text-xs text-white/50 mt-0.5">Trades covered</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center gap-1 justify-center lg:justify-start mb-1">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">NCC</div>
                <div className="text-xs text-white/50 mt-0.5">Rate references</div>
              </div>
            </div>
          </div>

          {/* ── Right column: product mockup ── */}
          <div className="flex-1 w-full lg:max-w-[480px]">
            <AppMockup />
          </div>

        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
