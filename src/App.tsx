import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout, AuthLayout } from "@/components/layout";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Integracoes from "@/pages/Integracoes";
import Usuarios from "@/pages/Usuarios";
import Empresa from "@/pages/Empresa";
import Campanhas from "@/pages/Campanhas";
import CampanhaDetalhe from "@/pages/CampanhaDetalhe";
import NovaCampanha from "@/pages/NovaCampanha";
import AdSetDetalhe from "@/pages/AdSetDetalhe";
import Criativos from "@/pages/Criativos";
import CriativoDetalhe from "@/pages/CriativoDetalhe";
import Auditorias from "@/pages/Auditorias";
import Politicas from "@/pages/Politicas";
import Relatorios from "@/pages/Relatorios";
import Billing from "@/pages/Billing";
import BrandConfig from "@/pages/BrandConfig";
import GoogleAds from "@/pages/GoogleAds";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Legal Routes */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Auth routes (no sidebar) */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Protected routes (with sidebar) */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campanhas" element={<Campanhas />} />
                <Route path="/campanhas/nova" element={<NovaCampanha />} />
                <Route path="/campanhas/:id" element={<CampanhaDetalhe />} />
                <Route path="/campanhas/:id/conjuntos/:adsetId" element={<AdSetDetalhe />} />
                <Route path="/criativos" element={<Criativos />} />
                <Route path="/criativos/:id" element={<CriativoDetalhe />} />
                <Route path="/auditorias" element={<Auditorias />} />
                <Route path="/politicas" element={<Politicas />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/brand" element={<BrandConfig />} />
                <Route path="/integracoes" element={<Integracoes />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/empresa" element={<Empresa />} />
                {/* <Route path="/google-ads" element={<GoogleAds />} /> */}
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Temporary placeholder component for pages not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-ch-white">{title}</h1>
      <p className="text-ch-text-muted mt-2">Esta página será implementada em breve.</p>
    </div>
  );
}

export default App;
