import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3aafb9",
          dark: "#093a3e",
          light: "#d4f1f4",
        },
        accent: {
          DEFAULT: "#64e9ee",
          light: "#cffafd",
        },
        ink: "#001011",
        teal: {
          dark: "#093a3e",
          DEFAULT: "#3aafb9",
          aqua: "#64e9ee",
          sky: "#97c8eb",
        },
        background: "#f5fbfc",
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 4px 12px rgba(0, 0, 0, 0.08)",
        lg: "0 12px 32px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
