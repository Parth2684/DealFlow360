import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AppProviders } from "../components/foundation/app-providers";
import { THEME_INIT_SCRIPT } from "../lib/theme";

export const metadata: Metadata = {
  applicationName: "DealFlow360",
  description:
    "A governed quote-to-cash workspace for pricing, approvals, fulfillment, billing, and customer negotiation.",
  title: {
    default: "DealFlow360",
    template: "%s | DealFlow360",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#f4f2ec", media: "(prefers-color-scheme: light)" },
    { color: "#0e1311", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint so a reload cannot flash
            the wrong palette. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          id="dealflow-theme-init"
        />
      </head>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
