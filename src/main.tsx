import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "./i18n";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
