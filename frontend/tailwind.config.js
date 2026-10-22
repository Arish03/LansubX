/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        industrial: {
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
          950: "#020617",
        },
        brand: {
          DEFAULT: "#0284c7",
          hover: "#0369a1",
          light: "#38bdf8",
        },
        cyber: {
          cyan: "#00f0ff",
          sky: "#38bdf8",
          emerald: "#10b981",
          purple: "#a855f7",
          violet: "#8b5cf6",
          amber: "#f59e0b",
          rose: "#f43f5e",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.25)",
        "glass-light": "0 8px 30px 0 rgba(31, 38, 135, 0.08)",
        "glow-cyan": "0 0 25px -5px rgba(0, 240, 255, 0.35)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.35)",
        "glow-purple": "0 0 25px -5px rgba(168, 85, 247, 0.35)",
        "glow-rose": "0 0 25px -5px rgba(244, 63, 94, 0.35)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: 0.8, filter: "brightness(1)" },
          "50%": { opacity: 0.4, filter: "brightness(1.4)" },
        },
      },
    },
  },
  plugins: [],
};
