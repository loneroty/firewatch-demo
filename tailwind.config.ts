import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c"
        },
        canopy: {
          50: "#ecfdf5",
          500: "#10b981",
          600: "#059669",
          700: "#047857"
        },
        smoke: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617"
        }
      },
      boxShadow: {
        panel: "0 12px 36px rgb(15 23 42 / 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
