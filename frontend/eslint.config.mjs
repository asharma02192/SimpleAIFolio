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
  ]),
  {
    rules: {
      // This app performs remote data loading and DOM-derived state
      // synchronization in React effects, which is intentional.
      // The rule flags async setState in effects as errors, but these
      // patterns are valid for client-side data fetching.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
