import { ReactNode, useState, useRef, useEffect } from "react";
import { useTour } from "@/context/TourContext";

interface TourTipProps {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export const TourTip = ({ text, children, position = "bottom" }: TourTipProps) => {
  const { tourEnabled } = useTour();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!tourEnabled) return <>{children}</>;

  const posClasses: Record<string, string> = {
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
  };

  const arrowClasses: Record<string, string> = {
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[#1a1a2e] border-x-transparent border-t-transparent border-4",
    top:    "top-full left-1/2 -translate-x-1/2 border-t-[#1a1a2e] border-x-transparent border-b-transparent border-4",
    right:  "right-full top-1/2 -translate-y-1/2 border-r-[#1a1a2e] border-y-transparent border-l-transparent border-4",
    left:   "left-full top-1/2 -translate-y-1/2 border-l-[#1a1a2e] border-y-transparent border-r-transparent border-4",
  };

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Glowing ring when tour is active */}
      <span className="absolute inset-0 rounded-md ring-2 ring-violet-500/50 ring-offset-1 ring-offset-background pointer-events-none animate-pulse" />
      {children}
      {visible && (
        <div className={`absolute z-50 ${posClasses[position]} pointer-events-none`}>
          <div className="relative bg-[#1a1a2e] border border-violet-500/40 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[220px] whitespace-normal leading-relaxed">
            <span className={`absolute ${arrowClasses[position]}`} />
            <span className="text-violet-400 font-semibold mr-1">Guide:</span>
            {text}
          </div>
        </div>
      )}
    </div>
  );
};
