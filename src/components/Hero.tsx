import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { isSignedIn } from "@/lib/localAuth";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

/* ─── Text scramble ──────────────────────────────────────────────────────── */
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#@$%&!?";

function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [output, setOutput] = useState(text);
  const frame = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const revealMs = 520;
      const tick = (ts: number) => {
        if (!start.current) start.current = ts;
        const elapsed = ts - start.current;
        const progress = Math.min(elapsed / revealMs, 1);
        const revealed = Math.floor(progress * text.length);
        setOutput(
          text.split("").map((ch, i) => {
            if (ch === "." || ch === " ") return ch;
            if (i < revealed) return ch;
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }).join("")
        );
        if (elapsed < revealMs + 60) {
          frame.current = requestAnimationFrame(tick);
        } else {
          setOutput(text);
        }
      };
      frame.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [text, delay]);

  return <>{output}</>;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.25, 0, 0.2, 1] as const } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

/* ─── Card 1: Floor Plan (front) ─────────────────────────────────────────── */
const FloorPlanCard = () => (
  <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.65)] bg-card">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-card/80 border-b border-white/8">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      </div>
      <span className="ml-2 text-[10px] text-white/30 font-mono">Ground_Floor_DA-01.pdf</span>
      <div className="ml-auto text-[9px] font-mono text-[#E1DCC9]/70 bg-[#E1DCC9]/8 border border-[#E1DCC9]/20 px-1.5 py-0.5 rounded">
        ✓ Calibrated 1:100
      </div>
    </div>
    <div className="bg-card relative">
      <svg viewBox="0 0 480 300" className="w-full" style={{ display: "block" }}>
        <defs>
          <pattern id="h-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(225,220,201,0.06)" strokeWidth="0.4" />
          </pattern>
          <pattern id="h-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#h-grid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(225,220,201,0.06)" strokeWidth="0.8" />
          </pattern>
          <marker id="h-end" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M 0 1 L 4 2.5 L 0 4 Z" fill="#E1DCC9" />
          </marker>
          <marker id="h-start" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto">
            <path d="M 5 1 L 1 2.5 L 5 4 Z" fill="#E1DCC9" />
          </marker>
        </defs>
        <rect width="480" height="300" fill="url(#h-grid-major)" />
        <rect x="50" y="28" width="390" height="248" fill="#1F150C" stroke="rgba(225,220,201,0.2)" strokeWidth="2" />
        <line x1="185" y1="28" x2="185" y2="276" stroke="rgba(225,220,201,0.2)" strokeWidth="1.5" />
        <line x1="185" y1="155" x2="440" y2="155" stroke="rgba(225,220,201,0.2)" strokeWidth="1.5" />
        <line x1="325" y1="28" x2="325" y2="276" stroke="rgba(225,220,201,0.2)" strokeWidth="1.5" />
        <text x="117" y="158" textAnchor="middle" fontSize="8" fill="rgba(225,220,201,0.3)" fontFamily="system-ui" letterSpacing="0.5">LIVING</text>
        <text x="255" y="94"  textAnchor="middle" fontSize="8" fill="rgba(225,220,201,0.3)" fontFamily="system-ui">KITCHEN</text>
        <text x="382" y="94"  textAnchor="middle" fontSize="8" fill="rgba(225,220,201,0.3)" fontFamily="system-ui">MASTER</text>
        <text x="255" y="224" textAnchor="middle" fontSize="8" fill="rgba(225,220,201,0.3)" fontFamily="system-ui">BED 2</text>
        <text x="382" y="224" textAnchor="middle" fontSize="8" fill="rgba(225,220,201,0.3)" fontFamily="system-ui">ENSUITE</text>
        <polygon points="50,28 185,28 185,276 50,276" fill="rgba(225,220,201,0.06)" stroke="#E1DCC9" strokeWidth="1.5" />
        <circle cx="50"  cy="28"  r="2.5" fill="#E1DCC9" />
        <circle cx="185" cy="28"  r="2.5" fill="#E1DCC9" />
        <circle cx="185" cy="276" r="2.5" fill="#E1DCC9" />
        <circle cx="50"  cy="276" r="2.5" fill="#E1DCC9" />
        <rect x="80" y="143" width="74" height="20" rx="4" fill="rgba(225,220,201,0.14)" stroke="#E1DCC9" strokeWidth="1" />
        <text x="117" y="157" textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#E1DCC9" fontWeight="bold">44.6 m²</text>
        <line x1="50" y1="16" x2="440" y2="16" stroke="#E1DCC9" strokeWidth="0.8" markerStart="url(#h-start)" markerEnd="url(#h-end)" />
        <rect x="202" y="7" width="56" height="12" rx="2" fill="#1F150C" />
        <text x="230" y="16" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#E1DCC9">13.2 m</text>
        <line x1="36" y1="28" x2="36" y2="276" stroke="#E1DCC9" strokeWidth="0.8" markerStart="url(#h-start)" markerEnd="url(#h-end)" />
        <rect x="12" y="142" width="38" height="12" rx="2" fill="#1F150C" />
        <text x="31" y="151" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#E1DCC9" transform="rotate(-90 31 151)">9.6 m</text>
        <circle cx="185" cy="276" r="5" fill="none" stroke="#E1DCC9" strokeWidth="1" opacity="0.6">
          <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="185" cy="276" r="2" fill="#E1DCC9" />
      </svg>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1.5 bg-background/90 border border-white/8 rounded text-[10px] font-mono backdrop-blur-sm">
        <span className="text-[#E1DCC9]">Polygon · 4 pts · 44.6 m²</span>
        <span className="text-white/25">Page 1 / 3</span>
      </div>
    </div>
  </div>
);

/* ─── Card 2: Cost Breakdown (middle-left) ────────────────────────────────── */
const CostCard = () => (
  <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.55)] bg-card">
    <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
      <span className="text-[11px] font-semibold text-white/80">Cost Summary</span>
      <span className="text-[9px] font-mono text-[#E1DCC9]/60 bg-primary/15 border border-[#E1DCC9]/15 rounded px-1.5 py-0.5">26 trades</span>
    </div>
    <div className="p-4 space-y-3">
      {[
        { t: "Framing & Structure", v: "$13,728", pct: 100 },
        { t: "Concrete & Footings",  v: "$15,904", pct: 116 },
        { t: "Roofing",              v: "$15,288", pct: 111 },
        { t: "Electrical",           v: "$9,120",  pct: 66  },
        { t: "Plumbing",             v: "$8,640",  pct: 63  },
      ].map((r) => (
        <div key={r.t}>
          <div className="flex justify-between text-[9px] mb-1.5">
            <span className="text-white/45">{r.t}</span>
            <span className="font-mono text-white/65">{r.v}</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(r.pct, 100)}%`,
                background: "linear-gradient(90deg, rgba(225,220,201,0.25), rgba(225,220,201,0.55))",
              }}
            />
          </div>
        </div>
      ))}
      <div className="pt-3 border-t border-white/6 flex justify-between items-center">
        <div>
          <div className="text-[8px] font-mono text-white/25 uppercase tracking-widest mb-0.5">TOTAL INC. MARGIN</div>
          <div className="text-[9px] font-mono text-white/40">$65,416 + 15%</div>
        </div>
        <span className="font-bold font-mono text-[#E1DCC9]" style={{ fontSize: "1.15rem" }}>$75,228</span>
      </div>
    </div>
  </div>
);

/* ─── Card 3: Tender PDF (back-right) ────────────────────────────────────── */
const TenderCard = () => (
  <div className="w-full h-full rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] bg-white">
    <div className="bg-background px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MetricoreLogoMark height={16} />
        <span className="text-[11px] font-bold text-white">Metricore</span>
      </div>
      <span className="text-[8px] font-mono text-white/35">Tender · PDF</span>
    </div>
    <div className="p-4">
      <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
        <div>
          <div className="font-bold text-gray-800 text-xs">Metricore Pty Ltd</div>
          <div className="text-[9px] text-gray-400 font-mono mt-0.5">ABN 12 345 678 901</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-gray-400 font-mono">REF-2024-0847</div>
          <div className="text-[9px] text-gray-400 font-mono mt-0.5">15 Oct 2024</div>
        </div>
      </div>
      <div className="text-[9px] font-mono text-gray-400 mb-3">42 Riverside Ave, Brisbane QLD 4000</div>
      <div className="space-y-1.5">
        {[
          { t: "Framing & Structure", v: "$13,728" },
          { t: "Concrete & Footings",  v: "$15,904" },
          { t: "Roofing Works",        v: "$15,288" },
          { t: "Electrical",           v: "$9,120"  },
          { t: "Plumbing",             v: "$8,640"  },
          { t: "Joinery & Finishing",  v: "$7,744"  },
        ].map((r) => (
          <div key={r.t} className="flex justify-between py-0.5">
            <span className="text-[9px] text-gray-500">{r.t}</span>
            <span className="text-[9px] font-mono text-gray-600">{r.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t-2 border-gray-800 flex justify-between items-center">
        <span className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">TOTAL INC. GST</span>
        <span className="font-bold font-mono text-sm text-gray-800">$75,228</span>
      </div>
      <div className="mt-3 flex justify-center">
        <div className="inline-flex items-center gap-1.5 bg-muted/10 border border-[#E1DCC9]/20 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-muted/100" />
          <span className="text-[9px] font-mono text-[#E1DCC9]/60 font-medium">Ready to send</span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Stacked Cards ──────────────────────────────────────────────────────── */
const StackedCards = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(rawX, [0, 1], [-10, 10]), { stiffness: 80, damping: 25 });
  const rotateX = useSpring(useTransform(rawY, [0, 1], [6, -6]),   { stiffness: 80, damping: 25 });

  return (
    <div
      ref={ref}
      className="relative w-full select-none"
      style={{ perspective: "1400px", perspectiveOrigin: "50% 40%" }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        rawX.set((e.clientX - r.left) / r.width);
        rawY.set((e.clientY - r.top)  / r.height);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        rawX.set(0.5);
        rawY.set(0.5);
      }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" as const }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
        className="relative"
      >
        {/* Card 3: Tender PDF — back right */}
        <motion.div
          className="absolute inset-0"
          animate={
            hovered
              ? { rotate: 12, x: 64, y: -28, scale: 0.84 }
              : { rotate: 6,  x: 32, y: -14, scale: 0.87 }
          }
          initial={{ rotate: 6, x: 32, y: -14, scale: 0.87 }}
          transition={{ duration: 0.55, ease: [0.25, 0, 0.2, 1] }}
          style={{ originX: "50%", originY: "0%", zIndex: 1 }}
        >
          <TenderCard />
        </motion.div>

        {/* Card 2: Cost Breakdown — back left */}
        <motion.div
          className="absolute inset-0"
          animate={
            hovered
              ? { rotate: -8, x: -56, y: 18, scale: 0.89 }
              : { rotate: -3, x: -18, y: 8,  scale: 0.92 }
          }
          initial={{ rotate: -3, x: -18, y: 8, scale: 0.92 }}
          transition={{ duration: 0.55, ease: [0.25, 0, 0.2, 1] }}
          style={{ originX: "50%", originY: "0%", zIndex: 2 }}
        >
          <CostCard />
        </motion.div>

        {/* Card 1: Floor Plan — front (sets container height) */}
        <motion.div
          className="relative"
          animate={hovered ? { scale: 1.025, y: -4 } : { scale: 1, y: 0 }}
          initial={{ scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0, 0.2, 1] }}
          style={{ zIndex: 10 }}
        >
          <FloorPlanCard />
        </motion.div>
      </motion.div>

      {/* Ambient glow under the stack */}
      <div className="absolute -bottom-10 left-16 right-16 h-16 bg-[#E1DCC9]/5 blur-2xl pointer-events-none" />
    </div>
  );
};

/* ─── Hero ───────────────────────────────────────────────────────────────── */
const Hero = () => {
  const heroRef = useRef<HTMLElement>(null);

  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const glowX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const glowY = useSpring(mouseY, { stiffness: 60, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseX.set(-1000); mouseY.set(-1000); }}
      className="relative min-h-screen flex items-center overflow-hidden pt-20 bg-background"
    >
      {/* Cursor-tracking glow */}
      <motion.div
        className="pointer-events-none absolute z-0 w-[500px] h-[500px] rounded-full bg-[#E1DCC9]/5 blur-[120px]"
        style={{ x: glowX, y: glowY, translateX: "-50%", translateY: "-50%" }}
      />

      {/* Static atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(225,220,201,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(225,220,201,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-[#E1DCC9]/3 rounded-full blur-[160px]" />
        <div className="absolute -bottom-20 right-0 w-[400px] h-[400px] bg-[#412D15]/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 lg:px-12 py-16 relative z-10 w-full">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 xl:gap-20 items-center">

          {/* ── Left: Copy ─────────────────────────────────────── */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">

            <motion.div variants={fadeIn} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-[#E1DCC9]/70 uppercase tracking-widest">
                Construction projects · Trades · Builders
              </span>
            </motion.div>

            <div className="space-y-0 -ml-1">
              {(["MEASURE.", "PRICE.", "WIN."] as const).map((word, i) => (
                <motion.h1
                  key={word}
                  variants={fadeUp}
                  className={`font-display font-bold leading-[0.88] tracking-tight ${i === 1 ? "text-[#E1DCC9]" : "text-white"}`}
                  style={{ fontSize: "clamp(4rem, 8.5vw, 7.5rem)" }}
                >
                  <ScrambleText text={word} delay={300 + i * 180} />
                </motion.h1>
              ))}
            </div>

            <motion.p variants={fadeIn} className="text-white/50 text-base sm:text-lg leading-relaxed max-w-sm">
              Drop in a plan, draw your measurements, and send a tender the same day. No spreadsheets. No Sunday nights doing maths.
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-wrap gap-4 items-center">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => window.location.href = isSignedIn() ? "/dashboard" : "/auth?mode=signup"}
                className="inline-flex items-center gap-2.5 bg-[#E1DCC9] text-black hover:bg-[#d4cfb5] font-bold text-base px-8 py-4 rounded-full transition-colors shadow-[0_0_40px_rgba(225,220,201,0.2)]"
              >
                Start free for 14 days
                <ArrowRight className="h-4 w-4" />
              </motion.button>
              <button
                className="text-white/50 hover:text-foreground/80 text-sm font-mono transition-colors flex items-center gap-2"
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              >
                See how it works <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>

            <motion.div variants={fadeIn} className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 border-t border-white/6">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {["BC", "DT", "JM"].map((i) => (
                    <div key={i} className="w-7 h-7 rounded-full bg-[#E1DCC9]/15 border border-[#E1DCC9]/20 flex items-center justify-center text-[10px] font-bold text-[#E1DCC9]/80">
                      {i}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-white/35 font-mono">Trusted by builders</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/8" />
              <span className="text-xs font-mono text-white/30 tracking-widest">QLD · NSW · VIC · WA</span>
              <div className="hidden sm:block w-px h-4 bg-white/8" />
              <span className="text-xs font-mono text-white/30">
                From <span className="text-white/60">$79</span>/mo
              </span>
            </motion.div>
          </motion.div>

          {/* ── Right: Stacked cards ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.85, delay: 0.3, ease: [0.25, 0, 0.2, 1] }}
            className="relative lg:pl-8"
          >
            <StackedCards />
          </motion.div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
};

export default Hero;
