import type { Metadata, Viewport } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNavigation } from "./components/SiteNavigation";
import navigationStyles from "./components/SiteNavigation.module.css";
import "./globals.css";

const dmSans = localFont({ src: "./fonts/dm-sans.woff2", weight: "400 800", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dapport.app"),
  title: {
    default: "Dapport — Solana apps. Any Android.",
    template: "%s · Dapport"
  },
  description: "Discover Solana apps shared by their publishers and install them on your compatible Android phone.",
  icons: {
    icon: [{ url: "/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    type: "website",
    siteName: "Dapport",
    title: "Dapport — Solana apps. Any Android.",
    description: "The publisher-authorized Android home for Solana apps.",
    images: [{ url: "/dapport-social-card.png", width: 1200, height: 630, alt: "Dapport — Solana apps. Any Android." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Dapport — Solana apps. Any Android.",
    description: "The publisher-authorized Android home for Solana apps.",
    images: ["/dapport-social-card.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#091018",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={dmSans.className}>
        <header className={navigationStyles.header}>
          <div className={navigationStyles.headerInner}>
            <SiteNavigation />
          </div>
        </header>
        {children}
        <footer className={navigationStyles.foot}>
          <Link className={navigationStyles.wordmark} href="/" aria-label="Dapport home">
            <Image src="/dapport-mark-512.png" alt="" width={25} height={25} /> Dapport
          </Link>
          <nav aria-label="Resources">
            <Link href="/download">How installation works</Link>
            <Link href="/security">FAQ &amp; security</Link>
            <Link href="/publisher">For publishers</Link>
          </nav>
          <small>© {currentYear} Dapport. Independent catalogue. Not operated by or endorsed by Solana Mobile.</small>
        </footer>
      </body>
    </html>
  );
}
