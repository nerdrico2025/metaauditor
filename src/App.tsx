import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/queryClient";
import { getPersistOptions } from "@/lib/queryPersist";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModuleProvider } from "@/contexts/ModuleContext";
import { AppLayout, AuthLayout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Loader2 } from "lucide-react";

const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Integracoes = lazy(() => import("@/pages/Integracoes"));
const Usuarios = lazy(() => import("@/pages/Usuarios"));
const Empresa = lazy(() => import("@/pages/Empresa"));
const Monitoramento = lazy(() => import("@/pages/Monitoramento"));
const Campanhas = lazy(() => import("@/pages/Campanhas"));
const Conjuntos = lazy(() => import("@/pages/Conjuntos"));
const CampanhaDetalhe = lazy(() => import("@/pages/CampanhaDetalhe"));
const NovaCampanha = lazy(() => import("@/pages/NovaCampanha"));
const AdSetDetalhe = lazy(() => import("@/pages/AdSetDetalhe"));
const Criativos = lazy(() => import("@/pages/Criativos"));
const CriativoDetalhe = lazy(() => import("@/pages/CriativoDetalhe"));
const Anuncios = lazy(() => import("@/pages/Anuncios"));
const Diagnosticos = lazy(() => import("@/pages/Diagnosticos"));
const Fury = lazy(() => import("@/pages/Fury"));
const Supervisor = lazy(() => import("@/pages/Supervisor"));
const Regras = lazy(() => import("@/pages/Regras"));
const Politicas = lazy(() => import("@/pages/Politicas"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Billing = lazy(() => import("@/pages/Billing"));
const BrandConfig = lazy(() => import("@/pages/BrandConfig"));
const Settings = lazy(() => import("@/pages/Settings"));
const ContextoIA = lazy(() => import("@/pages/ContextoIA"));
const Preferencias = lazy(() => import("@/pages/Preferencias"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));

const queryClient = createQueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="flex w-full max-w-4xl flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-ch-orange" />
        <PageSkeleton className="w-full opacity-60" kpiCount={4} sections={1} />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/monitoramento" element={<Monitoramento />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/conjuntos" element={<Conjuntos />} />
          <Route path="/campanhas/nova" element={<NovaCampanha />} />
          <Route path="/campanhas/:id" element={<CampanhaDetalhe />} />
          <Route path="/campanhas/:id/conjuntos/:adsetId" element={<AdSetDetalhe />} />
          <Route path="/criativos" element={<Criativos />} />
          <Route path="/criativos/:id" element={<CriativoDetalhe />} />
          <Route path="/anuncios" element={<Anuncios />} />
          <Route path="/diagnosticos" element={<Diagnosticos />} />
          <Route path="/recomendacoes" element={<Diagnosticos />} />
          <Route path="/fury" element={<Fury />} />
          <Route path="/supervisor" element={<Supervisor />} />
          <Route path="/regras" element={<Regras />} />
          <Route path="/politicas" element={<Politicas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/brand" element={<BrandConfig />} />
          <Route path="/integracoes" element={<Integracoes />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/empresa" element={<Empresa />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/contexto" element={<ContextoIA />} />
          <Route path="/preferencias" element={<Preferencias />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={getPersistOptions()}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <AuthProvider>
            <ModuleProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ModuleProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
