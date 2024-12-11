import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "node22",
    outDir: "dist",
    ssr: true,
    rollupOptions: {
      input: "src/main.ts",
      output: {
        format: "esm",
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include:
      mode === "contract"
        ? ["src/**/*.contract.test.{ts,tsx}"] // Only contract tests
        : ["src/**/*.{test,spec}.{ts,tsx}", "!src/**/*.contract.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "**/types/**", "data/**"],
    testTimeout: mode === "contract" ? 10000 : 5000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/**", "dist/**", "**/types/**"],
    },
  },
}));
