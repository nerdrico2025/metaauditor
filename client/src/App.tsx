import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/contexts/AuthContext";
import { MetaAccountProvider } from "@/contexts/MetaAccountContext";
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

// Users
import Users from "@/pages/users";

// Admin
import SuperAdmin from "@/pages/admin";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmpresas from "@/pages/admin/empresas";
import AdminPlanos from "@/pages/admin/planos";
import AdminUsuarios from "@/pages/admin/usuarios";
import AdminConfiguracoes from "@/pages/admin/configuracoes";

// Error Pages
import NotFound from "@/pages/errors/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
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
      <Route path="/company">
        <ProtectedRoute>
          <Company />
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <Users />
        </ProtectedRoute>
      </Route>
      <Route path="/super-admin">
        <ProtectedRoute requireSuperAdmin={true}>
          <SuperAdmin />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute requireSuperAdmin={true}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/empresas">
        <ProtectedRoute requireSuperAdmin={true}>
          <AdminEmpresas />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/planos">
        <ProtectedRoute requireSuperAdmin={true}>
          <AdminPlanos />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/usuarios">
        <ProtectedRoute requireSuperAdmin={true}>
          <AdminUsuarios />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/configuracoes">
        <ProtectedRoute requireSuperAdmin={true}>
          <AdminConfiguracoes />
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
        <MetaAccountProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </MetaAccountProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;