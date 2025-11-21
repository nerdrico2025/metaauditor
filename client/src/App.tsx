import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/contexts/AuthContext";
// Auth Pages
import Login from "@/pages/auth/login";

// Dashboard
import Dashboard from "@/pages/dashboard";

// Campaigns Module (with hierarchy: Campaigns → AdSets → Creatives)
import Campaigns from "@/pages/campaigns";
import AdSets from "@/pages/campaigns/ad-sets";
import Creatives from "@/pages/campaigns/creatives";

// Reports & History
import Reports from "@/pages/reports";
import History from "@/pages/history";

// Policies
import Policies from "@/pages/policies";

// Integrations (Meta & Google)
import Integrations from "@/pages/integrations";
import MetaIntegrations from "@/pages/integrations/meta";
import GoogleIntegrations from "@/pages/integrations/google";

// Settings
import Settings from "@/pages/settings";
import BrandSettings from "@/pages/settings/brand";
import ContentCriteria from "@/pages/settings/content-criteria";
import Company from "@/pages/settings/company";

// Admin
import SuperAdmin from "@/pages/admin";

// Debug
import MetaDebug from "@/pages/debug/MetaDebug";

// Error Pages
import NotFound from "@/pages/errors/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute>
          <Campaigns />
        </ProtectedRoute>
      </Route>
      <Route path="/adsets">
        <ProtectedRoute>
          <AdSets />
        </ProtectedRoute>
      </Route>
      <Route path="/creatives">
        <ProtectedRoute>
          <Creatives />
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/policies">
        <ProtectedRoute>
          <Policies />
        </ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute>
          <History />
        </ProtectedRoute>
      </Route>
      <Route path="/integrations">
        <ProtectedRoute>
          <Integrations />
        </ProtectedRoute>
      </Route>
      <Route path="/integrations/meta">
        <ProtectedRoute>
          <MetaIntegrations />
        </ProtectedRoute>
      </Route>
      <Route path="/integrations/google">
        <ProtectedRoute>
          <GoogleIntegrations />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      <Route path="/settings/brand">
        <ProtectedRoute>
          <BrandSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/settings/content-criteria">
        <ProtectedRoute>
          <ContentCriteria />
        </ProtectedRoute>
      </Route>
      <Route path="/settings/company">
        <ProtectedRoute>
          <Company />
        </ProtectedRoute>
      </Route>
      <Route path="/super-admin">
        <ProtectedRoute requireSuperAdmin={true}>
          <SuperAdmin />
        </ProtectedRoute>
      </Route>
      <Route path="/debug/meta">
        <ProtectedRoute>
          <MetaDebug />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;