import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AIChatbot } from "@/components/AIChatbot";
import { isSignedIn } from "@/lib/localAuth";
import { getSubscriptionStatus } from "@/lib/subscription";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";
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
import NotFound from "./pages/NotFound";

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AIChatbot />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
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
    </QueryClientProvider>
  );
};

export default App;
