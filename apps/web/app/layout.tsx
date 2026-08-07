import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Android Hub",
  description: "A consent-based catalogue for independently verified Android releases on Solana."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">Solana Android Hub</Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Catalogue</Link>
            <Link href="/publisher">Publisher</Link>
          </nav>
        </header>
        {children}
        <footer>Independent catalogue · Not affiliated with Solana Mobile.</footer>
      </body>
    </html>
  );
}
