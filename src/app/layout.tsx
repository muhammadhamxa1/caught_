import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans/wdth.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Caught", template: "%s | Caught" },
  description: "A link in bio for TikTok Shop affiliates. Nothing slips.",
};

export const viewport: Viewport = {
  themeColor: "#f4f1e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
