import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
    setupFiles: ["./vitest-setup.ts"],
    include: ["src/**/*.contract.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "**/types/**", "data/**"],
    testTimeout: 5000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/**", "dist/**", "**/types/**"],
    },
  },
});
