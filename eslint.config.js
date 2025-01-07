import js from "@eslint/js";
import eslintPluginImportX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  eslintPluginImportX.flatConfigs.recommended,
  eslintPluginImportX.flatConfigs.typescript,
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
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "Use '@/' imports instead of relative parent imports",
            },
            // {
            //   group: ["./*"],
            //   message: "Use '@/' imports instead of relative imports",
            // },
            // {
            //   group: ["."],
            //   message: "Use '@/' imports instead of relative imports",
            // },
          ],
        },
      ],
    },
    settings: {},
  },
);
