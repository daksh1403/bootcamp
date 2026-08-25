import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // operational scripts run directly with node/tsx, outside the Next.js lint scope
      "scripts/**/*.cjs",
    ],
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Test suites intentionally assert against dynamic SQLite rows.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
