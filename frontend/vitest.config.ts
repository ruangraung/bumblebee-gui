import path from "path";
import { defineConfig } from "vitest/config";

// The pure logic in src/lib is unit-tested here. `environment: "node"` is
// deliberate: these modules are plain functions with no React or DOM in them,
// so the suite needs neither jsdom nor the React plugin.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
