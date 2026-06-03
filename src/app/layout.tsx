import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "AI Provider Budget Monitor",
  description:
    "Multi-provider AI spend, credit, usage, and limit monitoring across OpenRouter, OpenAI, and Anthropic.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav />
            <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
