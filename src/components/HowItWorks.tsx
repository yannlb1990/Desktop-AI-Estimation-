import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, PenLine, FileCheck } from "lucide-react";

const viewportOpts = { once: true, margin: "-60px" } as const;

/* ─── Animated counter ─────────────────────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = Date.now();
          const duration = 1200;
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * to));
            if (progress < 1) requestAnimationFrame(tick);
            else setCount(to);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ─── Step visuals ─────────────────────────────────────────────────────────── */

function UploadVisual() {
  return (
    <div className="relative w-full h-52 flex items-center justify-center">
      <div className="w-64 h-40 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/[0.04] flex flex-col items-center justify-center gap-3 relative">
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/80 border border-foreground/10 rounded-xl px-4 py-2.5 shadow-lg"
          style={{ animation: "hiw-float 2s ease-in-out infinite alternate" }}
        >
          <div className="w-8 h-10 rounded bg-red-500/20 border border-red-400/30 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-red-400">PDF</span>
          </div>
          <div>
            <div className="text-[11px] font-mono text-foreground/70 leading-none font-medium">Ground_Floor_DA-01.pdf</div>
            <div className="text-[9px] text-foreground/30 mt-1">2.4 MB · Architectural Plans</div>
          </div>
        </div>
        <Upload className="h-6 w-6 text-primary/40" />
        <span className="text-[11px] font-mono text-foreground/25">Drop any PDF, DXF or image</span>
      </div>
      <div className="absolute bottom-2 right-6 text-[9px] font-mono text-primary/70 bg-primary/8 border border-primary/20 px-2.5 py-1 rounded-full">
        ✓ Plan loaded · 3 pages
      </div>
      <div className="absolute bottom-2 left-6 text-[9px] font-mono text-foreground/20 bg-foreground/4 border border-foreground/8 px-2.5 py-1 rounded-full">
        PDF · PNG · JPG · DXF
      </div>
      <style>{`
        @keyframes hiw-float {
          from { transform: translateX(-50%) translateY(-5px); }
          to   { transform: translateX(-50%) translateY(5px); }
        }
      `}</style>
    </div>
  );
}

function MeasureVisual() {
  return (
    <div className="relative w-full h-56 flex items-center justify-center">
      <div className="w-full max-w-sm h-52 rounded-xl overflow-hidden border border-foreground/8 bg-card relative">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border-b border-foreground/6">
          <span className="text-[9px] font-mono text-foreground/25 flex-1 truncate">Ground_Floor_DA-01.pdf · Page 1</span>
          <span className="text-[8px] font-mono text-primary/70/70 bg-primary/8 px-1.5 py-0.5 rounded">1:100</span>
        </div>
        <svg viewBox="0 0 320 175" className="w-full h-full" style={{ display: "block" }}>
          <defs>
            <pattern id="hiw-grid" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 0 0 0 14" fill="none" stroke="hsl(var(--primary) / 0.06)" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="320" height="175" fill="url(#hiw-grid)" />
          <rect x="20" y="12" width="280" height="155" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.35)" strokeWidth="1.8" />
          <line x1="140" y1="12" x2="140" y2="167" stroke="hsl(var(--primary) / 0.25)" strokeWidth="1.2" />
          <line x1="140" y1="95" x2="300" y2="95" stroke="hsl(var(--primary) / 0.25)" strokeWidth="1.2" />
          <line x1="220" y1="12" x2="220" y2="167" stroke="hsl(var(--primary) / 0.25)" strokeWidth="1.2" />
          <polygon points="20,12 140,12 140,167 20,167" fill="hsl(var(--primary) / 0.10)" stroke="hsl(var(--primary))" strokeWidth="1.4" />
          <circle cx="20" cy="12" r="2.5" fill="hsl(var(--primary))" />
          <circle cx="140" cy="12" r="2.5" fill="hsl(var(--primary))" />
          <circle cx="140" cy="167" r="2.5" fill="hsl(var(--primary))" />
          <circle cx="20" cy="167" r="2.5" fill="hsl(var(--primary))" />
          <rect x="45" y="79" width="66" height="18" rx="4" fill="hsl(var(--primary) / 0.22)" stroke="hsl(var(--primary))" strokeWidth="0.8" />
          <text x="78" y="91" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="hsl(var(--primary))" fontWeight="bold">44.6 m²</text>
          <text x="80" y="50" textAnchor="middle" fontSize="7" fill="hsl(var(--primary) / 0.3)" fontFamily="system-ui">LIVING / DINING</text>
          <text x="178" y="50" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary) / 0.25)" fontFamily="system-ui">KITCHEN</text>
          <text x="257" y="50" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary) / 0.25)" fontFamily="system-ui">MASTER</text>
          <text x="178" y="130" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary) / 0.25)" fontFamily="system-ui">BED 2</text>
          <text x="257" y="130" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary) / 0.25)" fontFamily="system-ui">WC / ENS</text>
          <circle cx="140" cy="167" r="5" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.5">
            <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="140" cy="167" r="2" fill="hsl(var(--primary))" />
        </svg>
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between px-2 py-1 bg-background/90 border border-foreground/6 rounded text-[8px] font-mono">
          <span className="text-primary">Polygon · 4 pts · 44.6 m²</span>
          <span className="text-foreground/20">3 rooms remaining</span>
        </div>
      </div>
    </div>
  );
}

function ExportVisual() {
  const docs = [
    { label: "Tender PDF",      color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.08)",  border: "hsl(var(--primary) / 0.20)" },
    { label: "BOQ / Costs",     color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.20)" },
    { label: "Gantt Schedule",  color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.20)" },
    { label: "Supplier Quotes", color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.20)" },
    { label: "FF&E Schedule",   color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.20)" },
  ];

  return (
    <div className="relative w-full h-56 flex items-center justify-center">
      <div className="w-full max-w-xs space-y-2">
        <div className="text-[9px] font-mono text-foreground/20 uppercase tracking-widest mb-3 text-center">Generated in one click</div>
        {docs.map((d, i) => (
          <div
            key={d.label}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border"
            style={{ background: d.bg, borderColor: d.border, opacity: 1 - i * 0.08 }}
          >
            <div className="w-6 h-7 rounded-sm flex items-center justify-center shrink-0" style={{ background: d.bg, border: `1px solid ${d.border}` }}>
              <span className="text-[7px] font-bold" style={{ color: d.color }}>PDF</span>
            </div>
            <span className="text-[11px] font-mono" style={{ color: d.color }}>{d.label}</span>
            <div className="ml-auto">
              <span className="text-[8px]" style={{ color: d.color }}>✓</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── How It Works ─────────────────────────────────────────────────────────── */
const steps = [
  {
    num: "01",
    icon: Upload,
    title: "Upload your blueprint",
    body: "Drag in any PDF, DXF, or image plan straight from your email or desktop. The plan analyser reads your blueprint and captures the scope of works before you draw a single measurement.",
    detail: "Supports PDF · PNG · JPG · DXF",
    visual: <UploadVisual />,
  },
  {
    num: "02",
    icon: PenLine,
    title: "Measure on the canvas",
    body: "Calibrate the scale once. Draw polygons for areas, lines for walls, dots for counts. Every measurement lands in the right trade column the moment you lift your cursor.",
    detail: "Calibrate once · Measure everything",
    visual: <MeasureVisual />,
  },
  {
    num: "03",
    icon: FileCheck,
    title: "Submit your quote and pricing",
    body: "Metricore prices everything at current Australian trade rates, adds your margin, and generates every document your project needs: quote, Gantt schedule, FF\&E and more.",
    detail: "Quote · BOQ · Gantt · FF&E · Pricing · Claims",
    visual: <ExportVisual />,
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-background py-20 md:py-28">
      <div className="container mx-auto px-6 lg:px-12">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOpts}
          transition={{ duration: 0.6, ease: [0.25, 0, 0.2, 1] }}
          className="max-w-2xl mb-16 md:mb-20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-primary/50" />
            <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">How it works</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-tight">
            Upload. Scope. Quote.
            <span className="block text-foreground/30 mt-1">Faster than you have ever quoted.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOpts}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.25, 0, 0.2, 1] }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-card/80 border border-foreground/8 flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary-foreground">{i + 1}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-foreground/25 tracking-widest uppercase mb-1">Step {step.num}</div>
                  <h3 className="font-display text-lg font-bold text-foreground leading-tight">{step.title}</h3>
                </div>
              </div>

              {step.visual}

              <div className="space-y-3">
                <p className="text-foreground/50 text-sm leading-relaxed">{step.body}</p>
                <div className="inline-flex items-center gap-2 text-[10px] font-mono text-primary/60 bg-primary/5 border border-primary/12 rounded-full px-3 py-1">
                  {step.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: [0.25, 0, 0.2, 1] }}
          className="mt-16 pt-10 border-t border-foreground/5 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10"
        >
          <div>
            <div className="font-mono text-3xl font-bold text-foreground">
              <Counter to={3} />x faster
            </div>
            <div className="text-sm text-foreground/30 mt-1">than estimating by hand or spreadsheet</div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-foreground/8" />
          <div>
            <div className="font-mono text-3xl font-bold text-foreground">
              <Counter to={26} />
            </div>
            <div className="text-sm text-foreground/30 mt-1">trade categories with current Australian rates</div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-foreground/8" />
          <div>
            <div className="font-mono text-3xl font-bold text-foreground">
              <Counter to={4} />
            </div>
            <div className="text-sm text-foreground/30 mt-1">Australian states with built-in rate tables</div>
          </div>
          <div className="sm:ml-auto">
            <button
              onClick={() => window.location.href = "/project/new"}
              className="inline-flex items-center px-7 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
            >
              Start your first takeoff
            </button>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default HowItWorks;
