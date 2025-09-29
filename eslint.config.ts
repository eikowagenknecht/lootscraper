import js from "@eslint/js";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import { importX } from "eslint-plugin-import-x";
import { jsdoc } from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  js.configs.recommended,
  jsdoc({
    config: "flat/recommended-typescript",
  }),
  importX.flatConfigs.recommended as Linter.Config, // see https://github.com/typescript-eslint/typescript-eslint/issues/11543
  importX.flatConfigs.typescript as Linter.Config, // see https://github.com/typescript-eslint/typescript-eslint/issues/11543
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    // Global ignores
    ignores: [
      "node_modules/",
      "dist/",
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
      "jsdoc/require-jsdoc": "off",
    },
    settings: {},
  },
);
