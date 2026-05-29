import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code's local git worktrees (fleet routines run here). Linting
    // them pulls in stale, divergent copies of the source and drowns real
    // findings in thousands of phantom problems.
    ".claude/**",
  ]),
]);

export default eslintConfig;
