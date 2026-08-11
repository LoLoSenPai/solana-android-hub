import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isPublisherOnboardingEnabled } from "@/server/publisher-availability";
import { SiteNavigation } from "./components/SiteNavigation";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dapport.app"),
  title: {
    default: "Dapport — Solana apps. Any Android.",
    template: "%s · Dapport"
  },
  description: "Discover publisher-approved Solana apps on the web, then install and manage them on any compatible Android phone.",
  icons: {
    icon: [{ url: "/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    type: "website",
    siteName: "Dapport",
    title: "Dapport — Solana apps. Any Android.",
    description: "The independent Android home for publisher-approved Solana apps.",
    images: [{ url: "/dapport-social-card.png", width: 1200, height: 630, alt: "Dapport — Solana apps. Any Android." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Dapport — Solana apps. Any Android.",
    description: "The independent Android home for publisher-approved Solana apps.",
    images: ["/dapport-social-card.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#091018",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const onboardingEnabled = isPublisherOnboardingEnabled(process.env.HELIUS_API_KEY);
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="wordmark" href="/#discover" aria-label="Dapport home">
              <Image src="/dapport-mark-512.png" alt="" width={48} height={48} priority />
              <span>Dapport <small>Solana apps · Android</small></span>
            </Link>
            <SiteNavigation onboardingEnabled={onboardingEnabled} />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <Image src="/dapport-mark-512.png" alt="" width={56} height={56} />
            <div><strong>Dapport</strong><span>Solana apps. Any Android.</span></div>
          </div>
          <div className="footer-links">
            <Link href="/catalog">Catalogue</Link>
            <Link href="/#trust-model">Trust model</Link>
            <Link href="/download">Get Dapport</Link>
            <Link href="/publisher">{onboardingEnabled ? "Publisher workspace" : "Publisher onboarding status"}</Link>
          </div>
          <p>© {currentYear} Dapport. Independent catalogue, not affiliated with or endorsed by Solana Mobile.</p>
        </footer>
      </body>
    </html>
  );
}
