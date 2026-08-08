import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isPublisherOnboardingEnabled } from "@/server/publisher-availability";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://solana-hub.lololabs.xyz"),
  title: {
    default: "Solana Android Hub",
    template: "%s · Solana Android Hub"
  },
  description: "An independent, consent-based catalogue for verifiable Android releases in the Solana ecosystem.",
  icons: {
    icon: "/hub-mark.png",
    apple: "/hub-mark.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#07110f",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const onboardingEnabled = isPublisherOnboardingEnabled(process.env.HELIUS_API_KEY);

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="wordmark" href="/" aria-label="Solana Android Hub home">
              <Image src="/hub-mark.png" alt="" width={48} height={48} priority />
              <span>Solana <small>Android Hub</small></span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/#discover">Discover</Link>
              <Link href="/#trust-model">Trust model</Link>
              <Link className="publisher-link" href="/publisher">{onboardingEnabled ? "For publishers" : "Publisher onboarding"}</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <Image src="/hub-mark.png" alt="" width={56} height={56} />
            <div><strong>Solana Android Hub</strong><span>A clearer way to discover independent Android apps.</span></div>
          </div>
          <div className="footer-links">
            <Link href="/">Catalogue</Link>
            <Link href="/publisher">{onboardingEnabled ? "Publisher workspace" : "Publisher onboarding status"}</Link>
          </div>
          <p>Independent catalogue. Not affiliated with or endorsed by Solana Mobile.</p>
        </footer>
      </body>
    </html>
  );
}
