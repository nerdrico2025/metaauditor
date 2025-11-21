import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
        ]
      : []),
  ],

  // 🔥 root NÃO deve ser alterado
  // Senão o Vite se perde no monorepo
  // root: path.resolve(import.meta.dirname),  ❌ REMOVIDO

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
      "@assets": path.resolve(__dirname, "../attached_assets"),
    },
  },

  build: {
    // ✔️ client deve buildar em SUA PRÓPRIA pasta
    outDir: "dist",
    emptyOutDir: true,
  },

  server: {
    // Nada especial aqui
    fs: {
      strict: false, // ← evita problemas em monorepo
    },
  },
});
