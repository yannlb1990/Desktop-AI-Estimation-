const trades = [
  "Builders",
  "Carpenters",
  "Electricians",
  "Plumbers",
  "Roofers",
  "Concreters",
  "Project Managers",
  "Quantity Surveyors",
  "Tilers",
  "Plasterers",
  "Painters",
  "Estimators",
  "Subbies",
  "Structural Engineers",
  "Landscapers",
  "Fitout Specialists",
];

const TradeList = ({ aria }: { aria?: boolean }) => (
  <div className="flex items-center shrink-0" aria-hidden={aria}>
    {trades.map((t) => (
      <span key={t} className="flex items-center">
        <span className="text-[13px] font-mono text-white/30 uppercase tracking-[0.15em] px-6 whitespace-nowrap">
          {t}
        </span>
        <span className="text-white/[0.12] text-sm select-none font-light">/</span>
      </span>
    ))}
  </div>
);

const TradeMarquee = () => (
  <div className="relative overflow-hidden py-5 bg-[#09111f]">
    <div
      className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
      style={{ background: "linear-gradient(to right, #09111f, transparent)" }}
    />
    <div
      className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
      style={{ background: "linear-gradient(to left, #09111f, transparent)" }}
    />

    <div className="flex" style={{ animation: "marquee-scroll 30s linear infinite" }}>
      <TradeList />
      <TradeList aria />
      <TradeList aria />
    </div>

    <style>{`
      @keyframes marquee-scroll {
        from { transform: translateX(0); }
        to   { transform: translateX(-33.333%); }
      }
    `}</style>
  </div>
);

export default TradeMarquee;
