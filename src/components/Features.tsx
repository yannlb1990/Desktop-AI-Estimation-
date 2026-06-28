import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useMotionValueEvent,
} from "framer-motion";
import { FileSearch, BadgeDollarSign, FileOutput } from "lucide-react";

/* ─── Takeoff Canvas Mockup ─────────────────────────────────────────────── */
const TakeoffPreview = () => (
  <div className="rounded-xl overflow-hidden border border-white/8 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
    <div className="flex items-center gap-2 px-3 py-2 bg-card/80 border-b border-white/8">
      <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /></div>
      <span className="text-[10px] text-white/30 font-mono ml-2 flex-1 truncate">Ground_Floor_DA-01.pdf</span>
      <span className="text-[9px] font-mono text-[#E1DCC9]/70 bg-[#E1DCC9]/8 border border-[#E1DCC9]/20 px-1.5 py-0.5 rounded">✓ 1:100</span>
    </div>
    <div className="flex">
      <div className="w-32 shrink-0 bg-background border-r border-white/6 p-2 space-y-1">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest px-1 mb-2">Measurements</div>
        {[
          { label: "Living Rm", val: "44.6 m²", active: true },
          { label: "Kitchen", val: "12.3 m²", active: false },
          { label: "Master Bed", val: "18.1 m²", active: false },
          { label: "Bed 2", val: "11.8 m²", active: false },
          { label: "Ensuite", val: "5.9 m²", active: false },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-1.5 px-1 py-0.5">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.active ? "bg-primary" : "bg-primary/15"}`} />
            <span className="text-[9px] text-white/40 flex-1 truncate">{r.label}</span>
            <span className={`text-[9px] font-mono ${r.active ? "text-[#E1DCC9]" : "text-[#E1DCC9]/40"}`}>{r.val}</span>
          </div>
        ))}
        <div className="border-t border-white/6 mt-2 pt-2 px-1 flex justify-between">
          <span className="text-[9px] text-white/30 font-mono">TOTAL</span>
          <span className="text-[9px] font-mono text-[#E1DCC9] font-bold">92.7 m²</span>
        </div>
      </div>
      <div className="flex-1 bg-card relative">
        <svg viewBox="0 0 280 200" className="w-full h-full" style={{ display: "block" }}>
          <defs>
            <pattern id="ft-grid" width="15" height="15" patternUnits="userSpaceOnUse">
              <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(225,220,201,0.06)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="280" height="200" fill="url(#ft-grid)" />
          <rect x="20" y="12" width="240" height="172" fill="#1F150C" stroke="rgba(225,220,201,0.2)" strokeWidth="2" />
          <line x1="110" y1="12" x2="110" y2="184" stroke="rgba(225,220,201,0.2)" strokeWidth="1.2" />
          <line x1="110" y1="100" x2="260" y2="100" stroke="rgba(225,220,201,0.2)" strokeWidth="1.2" />
          <line x1="190" y1="12" x2="190" y2="184" stroke="rgba(225,220,201,0.2)" strokeWidth="1.2" />
          <polygon points="20,12 110,12 110,184 20,184" fill="rgba(225,220,201,0.08)" stroke="#E1DCC9" strokeWidth="1.2" />
          <circle cx="20" cy="12" r="2" fill="#E1DCC9" /><circle cx="110" cy="12" r="2" fill="#E1DCC9" />
          <circle cx="110" cy="184" r="2" fill="#E1DCC9" /><circle cx="20" cy="184" r="2" fill="#E1DCC9" />
          <rect x="35" y="89" width="56" height="16" rx="3" fill="rgba(225,220,201,0.2)" stroke="#E1DCC9" strokeWidth="0.8" />
          <text x="63" y="100" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#E1DCC9" fontWeight="bold">44.6 m²</text>
          <text x="65" y="58" textAnchor="middle" fontSize="6.5" fill="rgba(225,220,201,0.35)" fontFamily="system-ui">LIVING / DINING</text>
          <text x="148" y="56" textAnchor="middle" fontSize="6" fill="rgba(225,220,201,0.25)" fontFamily="system-ui">KITCHEN</text>
          <text x="222" y="56" textAnchor="middle" fontSize="6" fill="rgba(225,220,201,0.25)" fontFamily="system-ui">MASTER</text>
          <text x="148" y="148" textAnchor="middle" fontSize="6" fill="rgba(225,220,201,0.25)" fontFamily="system-ui">BED 2</text>
          <text x="222" y="148" textAnchor="middle" fontSize="6" fill="rgba(225,220,201,0.25)" fontFamily="system-ui">ENSUITE</text>
          <circle cx="110" cy="184" r="5" fill="none" stroke="#E1DCC9" strokeWidth="0.8" opacity="0.5">
            <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="110" cy="184" r="2" fill="#E1DCC9" />
        </svg>
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between px-2 py-1 bg-background/90 border border-white/6 rounded text-[9px] font-mono">
          <span className="text-[#E1DCC9]">Polygon · 4 pts · 44.6 m²</span>
          <span className="text-white/25">Page 1 / 3</span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Cost Breakdown Mockup ──────────────────────────────────────────────── */
const CostBreakdownPreview = () => (
  <div className="rounded-xl overflow-hidden border border-white/8 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
    <div className="flex items-center gap-2 px-3 py-2.5 bg-card/80 border-b border-white/8">
      <BadgeDollarSign className="h-3.5 w-3.5 text-[#E1DCC9]/70" />
      <span className="text-[10px] text-white/40 font-mono">Trade Breakdown — 42 Riverside Ave</span>
      <span className="ml-auto text-[9px] font-mono text-[#E1DCC9]/70 bg-[#E1DCC9]/8 border border-[#E1DCC9]/20 px-1.5 py-0.5 rounded">✓ QLD Rates 2024</span>
    </div>
    <div className="p-4 space-y-0.5">
      <div className="grid grid-cols-[1fr_56px_52px_60px] gap-2 pb-2 border-b border-white/6 mb-1">
        {["TRADE", "QTY", "RATE", "TOTAL"].map((h) => (
          <span key={h} className="text-[9px] font-mono text-white/25 uppercase tracking-wider">{h}</span>
        ))}
      </div>
      {[
        { trade: "Framing",       qty: "286 m²", rate: "$48",  total: "$13,728" },
        { trade: "Concrete slab", qty: "142 m²", rate: "$112", total: "$15,904" },
        { trade: "Roofing",       qty: "156 m²", rate: "$98",  total: "$15,288" },
        { trade: "Electrical",    qty: "24 pts", rate: "$380", total: "$9,120"  },
        { trade: "Plumbing",      qty: "12 pts", rate: "$680", total: "$8,160"  },
        { trade: "Waterproofing", qty: "48 m²",  rate: "$67",  total: "$3,216"  },
      ].map((r) => (
        <div key={r.trade} className="grid grid-cols-[1fr_56px_52px_60px] gap-2 py-1 px-1 -mx-1 hover:bg-white/3 rounded transition-colors">
          <span className="text-[10px] text-white/60">{r.trade}</span>
          <span className="text-[10px] font-mono text-white/35">{r.qty}</span>
          <span className="text-[10px] font-mono text-white/35">{r.rate}</span>
          <span className="text-[10px] font-mono text-white/60 text-right">{r.total}</span>
        </div>
      ))}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#E1DCC9]/8 border border-[#E1DCC9]/15">
          <span className="text-[10px] font-mono text-white font-semibold uppercase tracking-wide">Base Estimate</span>
          <span className="text-[12px] font-bold text-white font-mono">$65,416</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
          <span className="text-[10px] font-mono text-white font-semibold uppercase tracking-wide">Margin (15%)</span>
          <span className="text-[12px] font-bold text-white font-mono">+$9,812</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#E1DCC9]/10 border border-[#E1DCC9]/15">
          <span className="text-[11px] font-bold text-white font-mono uppercase tracking-wide">Total inc. GST</span>
          <span className="text-[14px] font-bold text-[#E1DCC9] font-mono">$75,228</span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Tender Mockup ──────────────────────────────────────────────────────── */
const TenderPreview = () => (
  <div className="rounded-xl overflow-hidden border border-white/8 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
    <div className="flex items-center gap-2 px-3 py-2.5 bg-card/80 border-b border-white/8">
      <FileOutput className="h-3.5 w-3.5 text-[#E1DCC9]/70" />
      <span className="text-[10px] text-white/40 font-mono">Tender_42_Riverside_Ave.pdf</span>
      <div className="ml-auto flex gap-2">
        <span className="text-[9px] font-mono text-white/30 px-1.5 py-0.5 rounded border border-white/10">PDF</span>
        <span className="text-[9px] font-mono text-white/30 px-1.5 py-0.5 rounded border border-white/10">XLSX</span>
      </div>
    </div>
    <div className="bg-white/95 mx-3 my-3 rounded p-4 shadow-inner">
      <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded bg-background flex items-center justify-center">
              <span className="text-[#E1DCC9] text-[8px] font-bold">M</span>
            </div>
            <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">BUILD.CO</span>
          </div>
          <div className="text-[8px] text-gray-400">ABN 45 123 456 789</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">Bill of Quantities</div>
          <div className="text-[8px] text-gray-400 mt-0.5">Tender #TND-2024-0042</div>
          <div className="text-[8px] text-gray-400">Valid: 30 days</div>
        </div>
      </div>
      <div className="mb-3 pb-2 border-b border-gray-100">
        <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Project</div>
        <div className="text-[9px] font-semibold text-gray-700">42 Riverside Ave, Gold Coast QLD 4217</div>
        <div className="text-[8px] text-gray-400">Client: J. Matthews · Estimator: B. Callahan</div>
      </div>
      <div className="space-y-0.5 mb-3">
        {[
          { n: "01", item: "Concrete Slab",       qty: "142 m²", total: "$15,904" },
          { n: "02", item: "Framing Structure",   qty: "286 m²", total: "$13,728" },
          { n: "03", item: "Roofing & Eaves",     qty: "156 m²", total: "$15,288" },
          { n: "04", item: "Electrical Rough-in", qty: "24 pts", total: "$9,120"  },
          { n: "05", item: "Plumbing Rough-in",   qty: "12 pts", total: "$8,160"  },
        ].map((r) => (
          <div key={r.n} className="grid grid-cols-[14px_1fr_42px_44px] gap-1 items-baseline">
            <span className="text-[7px] text-gray-400 font-mono">{r.n}</span>
            <span className="text-[8px] text-gray-600">{r.item}</span>
            <span className="text-[8px] text-gray-400 font-mono text-right">{r.qty}</span>
            <span className="text-[8px] text-gray-600 font-mono text-right">{r.total}</span>
          </div>
        ))}
      </div>
      <div className="bg-gray-50 rounded px-2 py-1.5">
        <div className="flex justify-between mb-0.5"><span className="text-[8px] text-gray-500">Subtotal</span><span className="text-[8px] font-mono text-gray-600">$65,416</span></div>
        <div className="flex justify-between mb-0.5"><span className="text-[8px] text-gray-500">Margin (15%)</span><span className="text-[8px] font-mono text-gray-600">$9,812</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <span className="text-[9px] font-bold text-gray-800">TOTAL INC. GST</span>
          <span className="text-[9px] font-bold text-gray-800">$75,228</span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Features data ─────────────────────────────────────────────────────── */
const features = [
  {
    num: "01",
    icon: FileSearch,
    title: "Measure from any PDF plan",
    description:
      "Drop in any PDF or DXF plan and start measuring straight away. Draw areas, walls, and counts on the canvas. Every quantity lands in the right trade column before you even reach for the phone.",
    visual: <TakeoffPreview />,
  },
  {
    num: "02",
    icon: BadgeDollarSign,
    title: "Auto-priced at Australian rates",
    description:
      "Your measurements pull live QLD, NSW, VIC, and WA labour and material rates the moment you draw them. Set your margin once and watch the total appear. No hunting for prices.",
    visual: <CostBreakdownPreview />,
  },
  {
    num: "03",
    icon: FileOutput,
    title: "One-click tender, ready to send",
    description:
      "Generate a professional BOQ and tender in PDF or Excel. Your logo, your rates, your client's name. Hit export and it is ready to go.",
    visual: <TenderPreview />,
  },
];

/* ─── Features (sticky scroll) ───────────────────────────────────────────── */
const Features = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(v < 0.33 ? 0 : v < 0.66 ? 1 : 2);
  });

  /* Each bar fills only during its feature's scroll window, then stays full */
  const w1 = useTransform(scrollYProgress, [0, 0.33], ["0%", "100%"]);
  const w2 = useTransform(scrollYProgress, [0.33, 0.66], ["0%", "100%"]);
  const w3 = useTransform(scrollYProgress, [0.66, 1.0], ["0%", "100%"]);
  const progressWidths = [w1, w2, w3];

  const feature = features[active];
  const FeatureIcon = feature.icon;

  return (
    <section id="features" className="bg-background">
      {/* Scroll track — 300 vh gives each of 3 steps one full viewport of travel */}
      <div ref={containerRef} style={{ height: "300vh" }} className="relative">
        <div className="sticky top-0 h-screen flex flex-col overflow-hidden">

          {/* Header — always visible while pinned */}
          <div className="container mx-auto px-6 lg:px-12 pt-14 pb-6 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-primary/15" />
              <span className="text-xs font-mono text-[#E1DCC9]/60 uppercase tracking-widest">The workflow</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">
              Three steps.
              <span className="block text-white/30 mt-1">That is the whole process.</span>
            </h2>
          </div>

          {/* Feature content — animates between steps */}
          <div className="flex-1 container mx-auto px-6 lg:px-12 flex items-center min-h-0">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center w-full">

              {/* Copy */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.38, ease: [0.25, 0, 0.2, 1] }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#E1DCC9]/10 border border-[#E1DCC9]/15 flex items-center justify-center flex-shrink-0">
                      <FeatureIcon className="h-5 w-5 text-[#E1DCC9]" />
                    </div>
                    <span className="font-mono text-sm text-white/30 tracking-widest">
                      STEP {feature.num}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl sm:text-[2.25rem] font-bold text-white leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-white/50 leading-relaxed text-base">
                    {feature.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Visual */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -14 }}
                  transition={{ duration: 0.42, ease: [0.25, 0, 0.2, 1] }}
                  className="relative"
                >
                  <div
                    className="absolute -top-8 -left-4 font-mono font-bold text-white/[0.03] select-none leading-none pointer-events-none z-0"
                    style={{ fontSize: "clamp(5rem, 12vw, 9rem)" }}
                    aria-hidden="true"
                  >
                    {feature.num}
                  </div>
                  <div className="relative z-10">{feature.visual}</div>
                </motion.div>
              </AnimatePresence>

            </div>
          </div>

          {/* Progress strip — scroll-linked fill per step */}
          <div className="container mx-auto px-6 lg:px-12 pb-8 shrink-0">
            <div className="flex items-center gap-4">
              {features.map((f, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1.5">
                  <div className="h-0.5 bg-white/8 rounded-full relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full"
                      style={{ width: progressWidths[i] }}
                    />
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-widest transition-colors duration-300 ${
                      i === active ? "text-[#E1DCC9]" : "text-white/20"
                    }`}
                  >
                    {f.title.split(" ").slice(0, 3).join(" ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Features;
