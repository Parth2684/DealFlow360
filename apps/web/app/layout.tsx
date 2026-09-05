import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { EB_Garamond } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import { ToastProvider } from "@/components/ui/toast";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DealFlow360",
  description: "Quotation-to-cash platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${ebGaramond.variable}`}>
      <body className={GeistSans.className}>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
