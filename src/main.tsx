import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App.tsx";
import "./index.css";

function isStaleChunkError(msg: string) {
  return msg.includes('Failed to fetch dynamically imported module') ||
         msg.includes('Importing a module script failed') ||
         msg.includes('error loading dynamically imported module');
}

// Catch stale-chunk errors that happen outside React (e.g. lazy imports in handlers)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (isStaleChunkError(msg)) window.location.reload();
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
    if (isStaleChunkError(error.message)) {
      window.location.reload();
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="1.5">
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
              background: '#00c8ff',
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
