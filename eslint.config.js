import globals from "globals";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "operations/**"
    ]
  },
  {
    files: ["app.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["recommendation.mjs", "server/domain/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.builtin
      }
    }
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "playwright.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.builtin
      }
    }
  }
];
