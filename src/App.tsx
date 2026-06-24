import React, { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AIChatbot } from "@/components/AIChatbot";
import { TourProvider } from "@/context/TourContext";
import { isSignedIn, getLocalUser, localSignOut } from "@/lib/localAuth";
import { getSubscriptionStatus } from "@/lib/subscription";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";

const IDLE_MS = 30 * 60 * 1000

const IdleGuard = () => {
  const navigate = useNavigate()
  useEffect(() => {
    const user = getLocalUser()
    if (!user) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(async () => { await localSignOut(); navigate('/auth', { replace: true }) }, IDLE_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(t); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [navigate])
  return null
}
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import ProjectDetail from "./pages/ProjectDetail";
import MarketInsights from "./pages/MarketInsights";
import Pricing from "./pages/Pricing";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import MaterialsLibrary from "./pages/MaterialsLibrary";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AcceptInvite from "./pages/AcceptInvite";
import SetupPassword from "./pages/SetupPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminRates from "./pages/AdminRates";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import Support from "./pages/Support";

const queryClient = new QueryClient();

// Syncs subscription from Supabase before any protected route renders.
// This prevents localStorage tampering — trial dates are recomputed from
// session.user.created_at (server-sourced) on every app load.
function useAuthSync() {
  // true once the Supabase sync is done (or we're not signed in, so no sync needed)
  const [ready, setReady] = useState(!isSignedIn());

  useEffect(() => {
    if (!isSignedIn()) { setReady(true); return; }
    // Run sync, then unblock rendering regardless of success/failure
    syncSubscriptionFromDB().finally(() => setReady(true));
  }, []);

  return ready;
}

// Guards all protected routes: must be signed in, sync must be complete, trial must not be expired
const ProtectedRoute = ({ children, syncReady }: { children: React.ReactNode; syncReady: boolean }) => {
  if (!isSignedIn()) return <Navigate to="/auth" replace />;
  // Hold rendering until server-side subscription data has been applied to localStorage
  if (!syncReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }
  const { isTrialExpired } = getSubscriptionStatus();
  if (isTrialExpired) return <Navigate to="/pricing" replace />;
  return <>{children}</>;
};

const App = () => {
  const syncReady = useAuthSync();

  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TourProvider>
      <TooltipProvider>
        <Analytics />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <IdleGuard />
          <AIChatbot />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/setup-password" element={<SetupPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/about" element={<About />} />
            <Route path="/support" element={<Support />} />
            <Route path="/app" element={<ProtectedRoute syncReady={syncReady}><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute syncReady={syncReady}><Dashboard /></ProtectedRoute>} />
            <Route path="/project/new" element={<ProtectedRoute syncReady={syncReady}><NewProject /></ProtectedRoute>} />
            <Route path="/project/:projectId" element={<ProtectedRoute syncReady={syncReady}><ProjectDetail /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute syncReady={syncReady}><MarketInsights /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute syncReady={syncReady}><Clients /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute syncReady={syncReady}><Settings /></ProtectedRoute>} />
            <Route path="/materials" element={<ProtectedRoute syncReady={syncReady}><MaterialsLibrary /></ProtectedRoute>} />
            <Route path="/admin/rates" element={<ProtectedRoute syncReady={syncReady}><AdminRates /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </TourProvider>
    </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
