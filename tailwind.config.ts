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
          DEFAULT: "#E11D1D",
          dark: "#9D1010",
          light: "#FCE0E0",
        },
        accent: {
          DEFAULT: "#F18181",
          light: "#FCE5E5",
        },
        ink: "#1A0303",
        red: {
          dark: "#9D1010",
          DEFAULT: "#E11D1D",
          mid: "#EC2929",
          rose: "#F18181",
          pink: "#F7B5B5",
          light: "#FBE0E0",
        },
        background: "#FDF5F5",
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
