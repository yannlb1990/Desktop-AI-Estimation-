import React, { useEffect } from "react";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import Support from "./pages/Support";

const queryClient = new QueryClient();

// Guards all protected routes: must be signed in + trial must not be expired
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isSignedIn()) return <Navigate to="/auth" replace />;
  const { isTrialExpired } = getSubscriptionStatus();
  if (isTrialExpired) return <Navigate to="/pricing" replace />;
  return <>{children}</>;
};

const App = () => {
  // On every app start, pull paid subscription state from DB so the
  // synchronous ProtectedRoute check always has fresh data.
  useEffect(() => {
    if (isSignedIn()) syncSubscriptionFromDB();
  }, []);

  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TourProvider>
      <TooltipProvider>
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
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/project/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
            <Route path="/project/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><MarketInsights /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/materials" element={<ProtectedRoute><MaterialsLibrary /></ProtectedRoute>} />
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
