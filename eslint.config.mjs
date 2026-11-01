// ESLint flat config. Adapted from the Vibe Coding Toolkit (revision 790a895):
// the toolkit's file-size rule plus official presets, per runtime.
// Severities were set from a measured baseline (see docs/quality.md): a rule
// with pre-existing violations starts at "warn" with a reduction plan; a rule
// with none is an "error".
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "release/**",
    "build/**",
    "graphify-out/**",
    ".claude/**",
    "src/lib/catalog.snapshot.json",
  ]),

  js.configs.recommended,

  // Electron main process, catalog and tools: CommonJS on Node.
  {
    files: ["electron/**/*.cjs", "scripts/**/*.cjs", "eslint-rules/**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },
  // Node ESM scripts and tool configs.
  {
    files: ["scripts/**/*.mjs", "*.config.{js,mjs}"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
  },
  // Renderer: React in the browser (Electron renderer or `npm run web`).
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // React Compiler rules from the v7 preset. The app does not use the
    // compiler; these flag patterns worth fixing gradually. Baseline debt is
    // tracked in docs/quality.md; promote each to "error" once it reaches zero.
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },

  {
    files: ["**/*.{js,jsx,cjs,mjs}"],
    plugins: { quality },
    rules: {
      // `const { secret, ...rest } = obj` deliberately drops fields.
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      // 4 files over the 350-line budget at adoption; see docs/quality.md.
      "quality/max-lines": "warn",
    },
  },
]);
