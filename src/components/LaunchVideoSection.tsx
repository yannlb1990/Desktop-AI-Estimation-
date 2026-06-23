import { useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSignedIn } from "@/lib/localAuth";

const LaunchVideoSection = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <section
      id="demo"
      className="relative py-24 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #081521 0%, #0c1d2e 60%, #081521 100%)" }}
    >
      {/* Grid backdrop */}
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
        <div className="text-center mb-12">
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
            Watch Metricore turn a PDF floor plan into a priced tender.
            Upload, calibrate, measure, estimate, schedule, send.
          </p>
        </div>

        {/* Video player */}
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
            className="relative rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: "56.25%" }}
          >
            {/* Loading skeleton */}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#081521]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
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
              SPACE TO PLAY · ← → TO SCRUB
            </span>
            <span className="text-white/40 text-xs font-mono">
              metricore.com.au
            </span>
          </div>
        </div>

        {/* CTA below the video */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            onClick={() => window.location.href = isSignedIn() ? "/dashboard" : "/auth?mode=signup"}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-lg px-8 py-6 h-auto font-semibold"
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-white/35 text-sm mt-3 font-mono">
            Plans from $79/month · No credit card required · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
};

export default LaunchVideoSection;
