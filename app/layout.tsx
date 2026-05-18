import type { Metadata } from "next";
import { CommandBar } from "@/components/CommandBar";
import { StatusBar } from "@/components/StatusBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEVIS — Terminal",
  description:
    "Macro / event terminal — Second Brain, market events, focus, charts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-bg text-zinc-100 antialiased">
        <CommandBar />
        <div className="flex-1 pb-8">{children}</div>
        <StatusBar />
      </body>
    </html>
  );
}
