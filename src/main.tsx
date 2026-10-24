import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App.tsx";
import "./index.css";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
    person_profiles: "identified_only",
  });
  (window as Window & { posthog?: typeof posthog }).posthog = posthog;
}

function isStaleChunkError(msg: string) {
  // With no signal a chunk can't load either: reloading then would only show Safari's offline page
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return msg.includes('Failed to fetch dynamically imported module') ||
         msg.includes('Importing a module script failed') ||
         msg.includes('error loading dynamically imported module');
}

// Keep a copy of the app on the device so it opens on site with no signal (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// Catch stale-chunk errors that happen outside React (e.g. lazy imports in handlers)
/** At most two automatic reloads per minute: a slow connection after a deploy must not loop. */
function reloadOnce() {
  try {
    const now = Date.now();
    const recent = JSON.parse(sessionStorage.getItem('chunk_reloads') || '[]').filter((t: number) => now - t < 60_000);
    if (recent.length >= 2) return false;
    sessionStorage.setItem('chunk_reloads', JSON.stringify([...recent, now]));
  } catch { /* storage blocked: reload once anyway */ }
  window.location.reload();
  return true;
}

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (isStaleChunkError(msg)) reloadOnce();
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    // Stale chunk after a deploy — reload silently to get the fresh bundle
    if (isStaleChunkError(error.message) && reloadOnce()) {
      return { error: null };
    }
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0704',
          color: '#d6cfc6',
          fontFamily: 'Inter, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          gap: '0.75rem',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D4A045" strokeWidth="1.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#8a7d72', margin: 0, maxWidth: '360px', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Try refreshing the page. If the problem keeps happening, contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              background: '#E1DCC9',
              color: '#0B0704',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
