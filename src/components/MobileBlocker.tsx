import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

/** Screens that need a desktop (plan takeoff, estimate tables). Public pages and
 *  the client's quote approval link stay usable on a phone. */
const DESKTOP_ONLY = /^\/(dashboard|project|insights|clients|settings|materials|admin)(\/|$)/;
const DISMISS_KEY = "metricore_mobile_continue";

export default function MobileBlocker() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <MetricoreLogoMark height={30} />
          <span style={{ color: "#E1DCC9", fontWeight: 700, fontSize: "1.4rem" }}>Metricore</span>
        </div>
        <p style={{ color: "#E1DCC9", fontWeight: 700, fontSize: "1.25rem", margin: "0 0 0.75rem" }}>On site with your phone</p>
        <p style={{ color: "#E1DCC9", fontSize: "0.9375rem", lineHeight: 1.6, margin: 0 }}>
          Walk the job room by room: photos, sizes, what needs doing. It goes straight into the
          project's estimate on your computer.
        </p>
        <button
          onClick={() => navigate("/site")}
          style={{
            marginTop: "1.25rem",
            width: "100%",
            background: "#E1DCC9",
            border: "none",
            borderRadius: "0.5rem",
            color: "#0B0704",
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open site visits
        </button>
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
          Open the full app anyway
        </button>
      </div>
    </div>
  );
}
