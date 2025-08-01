import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import Creatives from "@/pages/Creatives";
import Reports from "@/pages/Reports";
import Policies from "@/pages/Policies";
import History from "@/pages/History";
import AITestingPage from "@/pages/AITestingPage";
import Integrations from "@/pages/Integrations";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/creatives" component={Creatives} />
      <Route path="/reports" component={Reports} />
      <Route path="/policies" component={Policies} />
      <Route path="/history" component={History} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/ai-testing" component={AITestingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
