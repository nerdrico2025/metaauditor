import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import tailwindcss from '@tailwindcss/vite';
import { cartographer } from '@replit/vite-plugin-cartographer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    tailwindcss(),
    cartographer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/client/src"),
      "@db": path.resolve(__dirname, "packages/database"),
      "@shared": path.resolve(__dirname, "packages/shared"),
      "@services": path.resolve(__dirname, "packages/services"),
    },
  },
  root: path.resolve(__dirname, "apps/client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});