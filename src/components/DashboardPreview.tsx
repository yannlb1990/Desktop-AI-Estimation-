import { motion } from "framer-motion";

const viewportOpts = { once: true, margin: "-60px" } as const;

const stats = [
  { label: "Active Projects", value: "24",    sub: "across all states" },
  { label: "Total Value",     value: "$4.2M", sub: "estimated this month" },
  { label: "Avg. Margin",     value: "18.5%", sub: "across all tenders" },
  { label: "Win Rate",        value: "67%",   sub: "tenders awarded" },
];

const projects = [
  { name: "Duplex Build — Gold Coast",     value: "$485,000", status: "Complete",    state: "QLD" },
  { name: "Renovation — Brisbane North",   value: "$125,000", status: "In Progress", state: "QLD" },
  { name: "Extension — Sunshine Coast",    value: "$215,000", status: "Complete",    state: "QLD" },
  { name: "New Build — Northern Beaches",  value: "$690,000", status: "Draft",       state: "NSW" },
];

const DashboardPreview = () => {
  return (
    <section id="insights" className="py-20 md:py-28 bg-[#000000]">
      <div className="container mx-auto px-6 lg:px-12">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOpts}
          transition={{ duration: 0.6, ease: [0.25, 0, 0.2, 1] }}
          className="max-w-2xl mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-primary/15" />
            <span className="text-xs font-mono text-[#E1DCC9]/70 uppercase tracking-widest">Command center</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">
            Every project.
            <span className="block text-white/30 mt-1">One place.</span>
          </h2>
          <p className="text-white/50 mt-4 text-base leading-relaxed max-w-xl">
            Track all your estimates, margins, and win rates without a spreadsheet in sight.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOpts}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0, 0.2, 1] }}
          className="rounded-2xl border border-white/8 bg-[#0c1825] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        >
          {/* App nav */}
          <div className="flex items-center gap-5 px-5 py-3 border-b border-white/[0.06] bg-[#000000]">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 rounded bg-[#000000] border border-foreground/20 flex items-center justify-center">
                <span className="text-[#E1DCC9] text-[9px] font-bold">M</span>
              </div>
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Metricore</span>
            </div>
            <div className="flex items-center gap-5 ml-2">
              {["Dashboard", "Projects", "Materials", "Settings"].map((n) => (
                <span
                  key={n}
                  className={`text-[11px] font-mono ${n === "Dashboard" ? "text-[#E1DCC9]" : "text-white/25"}`}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="ml-auto">
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-foreground/20 flex items-center justify-center">
                <span className="text-[9px] text-[#E1DCC9] font-bold">JB</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.05] border-b border-white/[0.05]">
            {stats.map((s) => (
              <div key={s.label} className="px-5 py-5">
                <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">{s.label}</div>
                <div className="font-mono text-2xl font-bold text-white leading-none">{s.value}</div>
                <div className="text-[10px] text-white/20 mt-1.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_90px_52px] gap-4 px-5 py-2.5 border-b border-white/[0.05] bg-[#000000]">
            {["PROJECT", "VALUE", "STATUS", "STATE"].map((h) => (
              <span key={h} className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {/* Table rows */}
          {projects.map((p, i) => (
            <div
              key={p.name}
              className="grid grid-cols-[1fr_110px_90px_52px] gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <span className="text-sm text-white/60 truncate">{p.name}</span>
              <span className="text-sm font-mono text-white/55">{p.value}</span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full text-center"
                style={
                  p.status === "Complete"
                    ? { background: "rgba(52,211,153,0.10)", color: "#34d399" }
                    : p.status === "In Progress"
                    ? { background: "rgba(34,211,238,0.10)", color: "#E1DCC9" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)" }
                }
              >
                {p.status}
              </span>
              <span className="text-[10px] font-mono text-white/25">{p.state}</span>
            </div>
          ))}

          {/* Footer */}
          <div className="px-5 py-3 bg-[#000000] border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/20">Showing 4 of 24 projects</span>
            <span className="text-[10px] font-mono text-[#E1DCC9]/70">view all →</span>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default DashboardPreview;
