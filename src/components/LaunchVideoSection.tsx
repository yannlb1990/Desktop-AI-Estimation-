import { useRef, useState, useEffect } from "react";
import { Play } from "lucide-react";

const LaunchVideoSection = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Reveal on scroll into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setRevealed(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="demo"
      className="relative py-24 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #081521 0%, #0c1d2e 60%, #081521 100%)" }}
    >
      {/* Animated grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#1fb6c9 1px, transparent 1px), linear-gradient(90deg, #1fb6c9 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(31,182,201,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section heading */}
        <div
          className="text-center mb-12"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-5">
            <Play className="h-3.5 w-3.5 text-primary fill-primary" />
            <span className="text-sm font-mono text-primary tracking-wider uppercase">
              Product Demo · 41 seconds
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            From plans to tender,
            <span className="block mt-1 bg-gradient-to-r from-primary via-cyan-300 to-white bg-clip-text text-transparent">
              in minutes.
            </span>
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Watch Metricore turn a PDF floor plan into a priced tender —
            upload, calibrate, measure, estimate, schedule, send.
          </p>
        </div>

        {/* Video player */}
        <div
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0) scale(1)" : "translateY(32px) scale(0.98)",
            transition: "opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s",
          }}
        >
          {/* Outer glow frame */}
          <div
            className="relative rounded-2xl mx-auto"
            style={{
              maxWidth: 1100,
              boxShadow:
                "0 0 0 1px rgba(31,182,201,0.25), 0 0 60px rgba(31,182,201,0.12), 0 40px 120px rgba(8,21,33,0.6)",
            }}
          >
            {/* 16:9 aspect ratio container */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ paddingBottom: "56.25%" }}
            >
              {/* Loading skeleton */}
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#081521]">
                  <div className="flex flex-col items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
                    />
                    <span className="text-white/40 text-sm font-mono tracking-wider">
                      Loading demo…
                    </span>
                  </div>
                </div>
              )}

              <iframe
                ref={iframeRef}
                src="/launch-video/index.html"
                title="Metricore product demo — from PDF plan to tender in 41 seconds"
                className="absolute inset-0 w-full h-full border-0"
                onLoad={() => setLoaded(true)}
                loading="lazy"
                allow="autoplay"
              />
            </div>

            {/* Bottom caption bar */}
            <div
              className="flex items-center justify-between px-5 py-3 rounded-b-2xl"
              style={{
                background: "rgba(8,21,33,0.92)",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-white/40 text-xs font-mono tracking-wide">
                USE SPACE TO PLAY · ← → TO SCRUB
              </span>
              <span className="text-white/40 text-xs font-mono">
                metricore.com.au
              </span>
            </div>
          </div>
        </div>

        {/* Three-stat strip below the video */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-14 max-w-3xl mx-auto text-center"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s",
          }}
        >
          {[
            { value: "Upload", label: "Drop any PDF or DXF plan" },
            { value: "Measure", label: "Area, wall, length, count by trade" },
            { value: "Tender", label: "Client-ready doc in one click" },
          ].map(({ value, label }) => (
            <div key={value} className="flex flex-col gap-1">
              <div className="text-xl font-bold text-primary font-mono">{value}</div>
              <div className="text-sm text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LaunchVideoSection;
