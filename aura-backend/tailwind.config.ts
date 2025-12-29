import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores do Aura System
        aura: {
          primary: "#6366F1",     // Indigo
          secondary: "#8B5CF6",   // Violet
          accent: "#EC4899",      // Pink
          success: "#10B981",     // Emerald
          warning: "#F59E0B",     // Amber
          danger: "#EF4444",      // Red
          info: "#3B82F6",        // Blue
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

