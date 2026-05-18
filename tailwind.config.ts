import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        panel: "#0a0a0b",
        border: "#262629",
        accent: "#f5a623",
        muted: "#6b6b72",
        pos: "#3ddc97",
        neg: "#ff6b6b",
        // medge-compatible aliases for ported chart components
        card: "#0a0a0b",
        "bg-secondary": "#121214",
        heading: "#e4e4e7",
        body: "#d1d1d6",
        text: "#e4e4e7",
        negative: "#ff6b6b",
        positive: "#3ddc97",
        divider: "#262629",
        "border-strong": "#3a3a3f",
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": "0.6875rem",
      },
      borderRadius: {
        card: "0px",
      },
    },
  },
  plugins: [],
};

export default config;
