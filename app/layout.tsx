import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event/Macro Studier",
  description:
    "Investment research tool — Second Brain, market events, anomaly detection, portfolio optimization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
