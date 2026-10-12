import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Screens that need a desktop (plan takeoff, estimate tables). Public pages and
 *  the client's quote approval link stay usable on a phone. */
const DESKTOP_ONLY = /^\/(dashboard|project|insights|clients|settings|materials|admin)(\/|$)/;
const DISMISS_KEY = "metricore_mobile_continue";

export default function MobileBlocker() {
  const { pathname } = useLocation();
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (width >= 1024 || dismissed || !DESKTOP_ONLY.test(pathname)) return null;

  const continueAnyway = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode: just hide */ }
    setDismissed(true);
  };

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
        <p style={{ color: "#D4A045", fontWeight: 700, fontSize: "1.5rem", marginBottom: "1rem" }}>
          Metricore
        </p>
        <p style={{ color: "#E1DCC9", fontSize: "0.9375rem", lineHeight: 1.6, margin: 0 }}>
          Metricore is built for desktop. Open it on your computer for the best
          experience.
        </p>
        <button
          onClick={continueAnyway}
          style={{
            marginTop: "1.25rem",
            background: "transparent",
            border: "1px solid #412D15",
            borderRadius: "0.5rem",
            color: "#E1DCC9",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
