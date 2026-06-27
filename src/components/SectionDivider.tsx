const SectionDivider = () => (
  <div className="relative w-full" style={{ height: "1px" }} aria-hidden="true">
    {/* Radial glow bleeds 24px into sections above and below */}
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{
        top: "-24px",
        bottom: "-24px",
        background:
          "radial-gradient(ellipse 45% 100% at 50% 50%, rgba(34,211,238,0.07), transparent 70%)",
        filter: "blur(10px)",
      }}
    />
    {/* Hairline */}
    <div className="absolute inset-0 bg-white/[0.07]" />
  </div>
);

export default SectionDivider;
