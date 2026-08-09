"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationItem {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
  publisher?: boolean;
}

const NAV_ITEMS: readonly NavigationItem[] = [
  { href: "/", label: "Discover", active: (pathname: string) => pathname === "/" },
  { href: "/catalog", label: "Catalogue", active: (pathname: string) => pathname === "/catalog" || pathname.startsWith("/apps/") },
  { href: "/download", label: "Get the Hub", active: (pathname: string) => pathname === "/download" },
  { href: "/publisher", label: "For publishers", active: (pathname: string) => pathname.startsWith("/publisher"), publisher: true }
];

export function SiteNavigation({ onboardingEnabled }: Readonly<{ onboardingEnabled: boolean }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const active = item.active(pathname);
        const label = item.publisher && !onboardingEnabled ? "Publisher onboarding" : item.label;
        return (
          <Link
            key={item.href}
            className={item.publisher ? "publisher-link" : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
