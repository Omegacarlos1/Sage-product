import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.jest, ...globals.mocha } },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["tests/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
