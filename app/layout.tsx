import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEVIS — Event/Macro Studier",
  description:
    "Investment research tool — Second Brain, market events, anomaly detection, portfolio optimization.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-zinc-100 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
