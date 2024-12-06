import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "node20",
    outDir: "dist",
    rollupOptions: {
      input: "src/main.ts",
    },
  },
});
