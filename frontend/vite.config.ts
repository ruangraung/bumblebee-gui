import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|react-router)([\\/]|$)/,
              priority: 20,
            },
            {
              name: "charts-vendor",
              test: /node_modules[\\/](recharts|d3-|victory-vendor)([\\/]|$)/,
              priority: 15,
            },
            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1", // loopback-only for host-run dev; the compose container overrides via `--host 0.0.0.0` (Dockerfile.frontend)
    // Allow access via the tailnet hostname (tailscale serve → ts.net) —
    // Vite's DNS-rebinding protection blocks non-localhost hosts by default.
    allowedHosts: [".ts.net"],
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
  // The browser specs load the built bundle through `vite preview`, never the
  // dev server and never the compose stack (that one serves `dist` through
  // nginx). Preview therefore needs its own port and proxy, aimed at a backend
  // started on the same host. Port 8001 keeps it clear of the compose service on
  // 8000, and `strictPort` makes a busy 5173 a hard failure instead of a silent
  // bump that would leave the specs pointed at nothing.
  preview: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
