import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#111114",
        border: "#1f1f23",
        accent: "#d4af37",
        muted: "#7a7a82",
      },
    },
  },
  plugins: [],
};

export default config;
