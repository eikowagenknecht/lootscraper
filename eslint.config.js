import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    // Global ignores
    ignores: [
      "node_modules/",
      "dist/",
      "tools/",
      "coverage/",
      "vitest-setup.ts",
      "*.config.js",
      "*.config.ts",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {},
    settings: {},
  }
);
