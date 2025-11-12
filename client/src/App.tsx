import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import SuperAdmin from "@/pages/SuperAdmin";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
import AdSets from "@/pages/AdSets";
import Creatives from "@/pages/creatives";
import Reports from "@/pages/Reports";
import Policies from "@/pages/policies";
import History from "@/pages/History";

// Integrations
import Integrations from "@/pages/integrations";
import MetaIntegrations from "@/pages/integrations/meta";
import GoogleIntegrations from "@/pages/integrations/google";

// Settings
import Settings from "@/pages/settings";
import BrandSettings from "@/pages/settings/brand";
import ContentCriteria from "@/pages/settings/content-criteria";
import Company from "@/pages/settings/company";

import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
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