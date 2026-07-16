import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "public/sw.js",
      "public/workbox-*.js",
      "public/worker-*.js",
      "functions/lib/**",
      "functions/lib-scripts/**"
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["info", "warn", "error"] }]
    }
  },
  {
    files: ["components/ReportList.tsx"],
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default eslintConfig;
