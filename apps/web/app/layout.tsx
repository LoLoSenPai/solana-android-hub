import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isPublisherOnboardingEnabled } from "@/server/publisher-availability";
import { SiteNavigation } from "./components/SiteNavigation";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://solana-hub.lololabs.xyz"),
  title: {
    default: "Solana Android Hub",
    template: "%s · Solana Android Hub"
  },
  description: "Discover Solana apps on the web, then install and manage them on the Android phone you already own.",
  icons: {
    icon: "/hub-mark.png",
    apple: "/hub-mark.png"
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
            <Link className="wordmark" href="/#discover" aria-label="Solana Android Hub home">
              <Image src="/hub-mark.png" alt="" width={48} height={48} priority />
              <span>Solana <small>Android Hub</small></span>
            </Link>
            <SiteNavigation onboardingEnabled={onboardingEnabled} />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <Image src="/hub-mark.png" alt="" width={56} height={56} />
            <div><strong>Solana Android Hub</strong><span>A clearer way to discover independent Android apps.</span></div>
          </div>
          <div className="footer-links">
            <Link href="/catalog">Catalogue</Link>
            <Link href="/#trust-model">Trust model</Link>
            <Link href="/download">Get Android Hub</Link>
            <Link href="/publisher">{onboardingEnabled ? "Publisher workspace" : "Publisher onboarding status"}</Link>
          </div>
          <p>© {currentYear} Solana Android Hub. Independent catalogue, not affiliated with or endorsed by Solana Mobile.</p>
        </footer>
      </body>
    </html>
  );
}
