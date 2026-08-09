import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSignedIn } from "@/lib/localAuth";

const LaunchVideoSection = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <section
      id="demo"
      className="relative py-16 md:py-24 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #000000 0%, #1F150C 60%, #000000 100%)" }}
    >
      {/* Grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(225,220,201,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(225,220,201,0.8) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(65,45,21,0.4) 0%, transparent 70%)",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section heading */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-5">
            <Play className="h-3.5 w-3.5 text-primary fill-primary" />
            <span className="text-sm font-mono text-primary tracking-wider uppercase">
              Product Demo · 41 seconds
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            From plans to quote,
            <span className="block mt-1 bg-gradient-to-r from-primary via-[#E1DCC9]/80 to-primary/60 bg-clip-text text-transparent">
              in minutes.
            </span>
          </h2>
          <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto">
            Watch Metricore turn a PDF floor plan into a priced quote.
            Upload, calibrate, measure, estimate, schedule, send.
          </p>
        </div>

        {/* Video player */}
        <div
          className="relative rounded-xl md:rounded-2xl mx-auto"
          style={{
            maxWidth: 1100,
            boxShadow:
              "0 0 0 1px rgba(225,220,201,0.15), 0 0 60px rgba(65,45,21,0.3), 0 40px 120px rgba(0,0,0,0.6)",
          }}
        >
          {/* 16:9 aspect ratio container */}
          <div
            className="relative rounded-t-xl md:rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: "56.25%" }}
          >
            {/* Loading skeleton */}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#000000]">
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
            className="flex items-center justify-between px-4 py-2.5 rounded-b-xl md:rounded-b-2xl"
            style={{
              background: "rgba(0,0,0,0.92)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-white/40 text-[10px] sm:text-xs font-mono tracking-wide">
              <span className="hidden sm:inline">SPACE TO PLAY · </span>← → TO SCRUB
            </span>
            <span className="text-white/40 text-[10px] sm:text-xs font-mono">
              metricore.com.au
            </span>
          </div>
        </div>

        {/* CTA below the video */}
        <div className="text-center mt-10 md:mt-12">
          <Button
            size="lg"
            onClick={() => window.location.href = isSignedIn() ? "/dashboard" : "/auth?mode=signup"}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-base md:text-lg px-8 py-6 h-auto font-semibold w-full sm:w-auto"
          >
            Start Free Trial
          </Button>
          <p className="text-white/35 text-xs sm:text-sm mt-3 font-mono">
            Plans from $79/month · No credit card required
          </p>
        </div>
      </div>
    </section>
  );
};

export default LaunchVideoSection;
