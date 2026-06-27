import { motion } from "framer-motion";

const viewportOpts = { once: true, margin: "-60px" } as const;

const exportDocs = [
  { label: "Tender PDF",      desc: "Branded BOQ ready to send",        color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.20)" },
  { label: "Cost Breakdown",  desc: "Trade-by-trade with your margin",   color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.18)" },
  { label: "Gantt Schedule",  desc: "Construction timeline per stage",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.18)" },
  { label: "Supplier Quotes", desc: "Email-ready RFQs per trade",        color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.18)" },
  { label: "FF&E Schedule",   desc: "Fixtures, fittings and equipment",  color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.18)" },
  { label: "Progress Claims", desc: "Stage payment claim documents",     color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.18)" },
];

const TakeoffVisual = () => {
  return (
    <section className="py-20 md:py-28 bg-[#09111f]">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOpts}
            transition={{ duration: 0.6, ease: [0.25, 0, 0.2, 1] }}
            className="space-y-6 lg:sticky lg:top-24"
          >
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-cyan-400/50" />
              <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">What comes out</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">
              One takeoff.
              <span className="block text-white/30 mt-1">Six documents, ready to send.</span>
            </h2>
            <p className="text-white/50 leading-relaxed">
              Upload your plans, measure on the canvas, and Metricore generates every document your project needs in the same session. Tender, Gantt, cost breakdown, FF&E — one click each.
            </p>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {exportDocs.map((e) => (
                <div key={e.label} className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0 mt-[7px]" style={{ background: e.color, opacity: 0.7 }} />
                  <div>
                    <div className="text-sm font-medium text-white/70">{e.label}</div>
                    <div className="text-xs text-white/30 mt-0.5">{e.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => window.location.href = "/project/new"}
              className="inline-flex items-center px-7 py-3 rounded-full bg-cyan-400 text-[#09111f] font-bold hover:bg-cyan-300 transition-colors"
            >
              Start a takeoff
            </button>
          </motion.div>

          {/* Right: canvas + export stack */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOpts}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0, 0.2, 1] }}
            className="space-y-3"
          >
            {/* Canvas mockup */}
            <div className="rounded-xl overflow-hidden border border-white/8 bg-[#0d1829] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#111e30] border-b border-white/8">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[10px] text-white/30 font-mono ml-2 flex-1 truncate">Ground_Floor_DA-01.pdf</span>
                <span className="text-[9px] font-mono text-emerald-400/80 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">✓ 1:100</span>
              </div>
              {/* Toolbar + canvas */}
              <div className="flex">
                <div className="w-10 shrink-0 bg-[#0a1522] border-r border-white/6 flex flex-col items-center py-3 gap-3">
                  {["↖", "—", "▭", "✏", "⊕"].map((sym) => (
                    <div key={sym} className="w-6 h-6 flex items-center justify-center rounded text-white/20 text-[10px]">
                      {sym}
                    </div>
                  ))}
                </div>
                <div className="flex-1 bg-[#0f1c2e] relative">
                  <svg viewBox="0 0 380 240" className="w-full" style={{ display: "block" }}>
                    <defs>
                      <pattern id="tv-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#1a3050" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="380" height="240" fill="url(#tv-grid)" />
                    <rect x="24" y="16" width="332" height="208" fill="#152030" stroke="#c8d8e8" strokeWidth="2" />
                    <line x1="150" y1="16" x2="150" y2="224" stroke="#c8d8e8" strokeWidth="1.2" />
                    <line x1="150" y1="130" x2="356" y2="130" stroke="#c8d8e8" strokeWidth="1.2" />
                    <line x1="260" y1="16" x2="260" y2="224" stroke="#c8d8e8" strokeWidth="1.2" />
                    <polygon points="24,16 150,16 150,224 24,224" fill="rgba(34,211,238,0.09)" stroke="#22d3ee" strokeWidth="1.4" />
                    <circle cx="24" cy="16" r="3" fill="#22d3ee" />
                    <circle cx="150" cy="16" r="3" fill="#22d3ee" />
                    <circle cx="150" cy="224" r="3" fill="#22d3ee" />
                    <circle cx="24" cy="224" r="3" fill="#22d3ee" />
                    <rect x="44" y="109" width="72" height="20" rx="4" fill="rgba(34,211,238,0.22)" stroke="#22d3ee" strokeWidth="0.8" />
                    <text x="80" y="123" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#22d3ee" fontWeight="bold">44.6 m²</text>
                    <text x="87" y="72" textAnchor="middle" fontSize="7.5" fill="rgba(200,216,232,0.28)" fontFamily="system-ui">LIVING / DINING</text>
                    <text x="197" y="68" textAnchor="middle" fontSize="7" fill="rgba(200,216,232,0.22)" fontFamily="system-ui">KITCHEN</text>
                    <text x="305" y="68" textAnchor="middle" fontSize="7" fill="rgba(200,216,232,0.22)" fontFamily="system-ui">MASTER BED</text>
                    <text x="197" y="178" textAnchor="middle" fontSize="7" fill="rgba(200,216,232,0.22)" fontFamily="system-ui">BED 2</text>
                    <text x="305" y="178" textAnchor="middle" fontSize="7" fill="rgba(200,216,232,0.22)" fontFamily="system-ui">ENSUITE</text>
                    <circle cx="150" cy="224" r="5" fill="none" stroke="#22d3ee" strokeWidth="0.8" opacity="0.5">
                      <animate attributeName="r" values="4;9;4" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="150" cy="224" r="2.5" fill="#22d3ee" />
                    <rect x="310" y="16" width="46" height="88" fill="rgba(10,21,34,0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                    <text x="316" y="28" fontSize="5.5" fill="rgba(255,255,255,0.25)" fontFamily="monospace">ITEMS</text>
                    {[
                      { y: 40, label: "Living", val: "44.6" },
                      { y: 52, label: "Kitchen", val: "18.3" },
                      { y: 64, label: "Master", val: "22.1" },
                      { y: 76, label: "Bed 2", val: "14.8" },
                    ].map((r) => (
                      <g key={r.label}>
                        <text x="316" y={r.y} fontSize="5" fill="rgba(255,255,255,0.3)" fontFamily="monospace">{r.label}</text>
                        <text x="352" y={r.y} textAnchor="end" fontSize="5" fill="rgba(34,211,238,0.7)" fontFamily="monospace">{r.val}</text>
                      </g>
                    ))}
                    <line x1="312" y1="88" x2="352" y2="88" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
                    <text x="352" y="100" textAnchor="end" fontSize="5.5" fill="#22d3ee" fontFamily="monospace" fontWeight="bold">99.8 m²</text>
                  </svg>
                  <div className="absolute bottom-1.5 left-12 right-2 flex items-center justify-between px-2 py-1 bg-[#0a1522]/90 border border-white/6 rounded text-[8px] font-mono">
                    <span className="text-cyan-400">Polygon · 4 pts · 44.6 m²</span>
                    <span className="text-white/20">Page 1 / 3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Export document cards */}
            <div className="grid grid-cols-3 gap-2">
              {exportDocs.map((e) => (
                <div
                  key={e.label}
                  className="rounded-lg px-3 py-2.5 border"
                  style={{ background: e.bg, borderColor: e.border }}
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest mb-0.5" style={{ color: e.color, opacity: 0.85 }}>
                    {e.label}
                  </div>
                  <div className="text-[8px] text-white/25 leading-tight">{e.desc}</div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default TakeoffVisual;
