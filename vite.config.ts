import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "src/routes", generatedRouteTree: "src/routeTree.gen.ts" }),
    react(),
  ],
  resolve: {
    alias: [
      // More-specific first.
      { find: "@/i18n/routing", replacement: path.resolve(__dirname, "./src/lib/router-compat.tsx") },
      { find: "next-intl/server", replacement: path.resolve(__dirname, "./src/lib/i18n-compat.ts") },
      { find: "next-intl", replacement: path.resolve(__dirname, "./src/lib/i18n-compat.ts") },
      { find: "next/link", replacement: path.resolve(__dirname, "./src/lib/router-compat.tsx") },
      { find: "next/navigation", replacement: path.resolve(__dirname, "./src/lib/router-compat.tsx") },
      { find: /^@\//, replacement: path.resolve(__dirname, "./src") + "/" },
    ],
  },
  server: {
    port: 8129,
    proxy: {
      "/api": {
        target: "http://localhost:8130",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
