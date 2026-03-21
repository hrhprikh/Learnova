import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F8F7F4",
        foreground: "#1A1C29",
        primary: {
          DEFAULT: "#1A1C29",
          light: "#2A2D43",
        },
        accent: {
          blue: "#4D9FFF",
          peach: "#FFB89E",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          hover: "#F2F0EB",
        },
        border: "#E8E5DF",
        muted: "#8E8B85",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["'Clash Display'", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      }
    }
  },
  plugins: []
};
export default config;
