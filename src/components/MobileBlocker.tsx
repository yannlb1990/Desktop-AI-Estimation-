import { useState, useEffect } from "react";

export default function MobileBlocker() {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (width >= 1024) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0B0704",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "#1A110A",
          border: "1px solid #412D15",
          borderRadius: "0.75rem",
          padding: "2rem",
          maxWidth: "360px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "#D4A045",
            fontWeight: 700,
            fontSize: "1.5rem",
            marginBottom: "1rem",
          }}
        >
          Metricore
        </p>
        <p
          style={{
            color: "#E1DCC9",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Metricore is built for desktop. Open it on your computer for the best
          experience.
        </p>
      </div>
    </div>
  );
}
