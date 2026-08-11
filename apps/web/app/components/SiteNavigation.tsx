"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavigationItem {
  href: string;
  label: string;
  active: (pathname: string, homepageSection: HomepageSection) => boolean;
  section?: HomepageSection;
  hub?: boolean;
  publisher?: boolean;
}

type HomepageSection = "discover" | "trust-model";

const NAV_ITEMS: readonly NavigationItem[] = [
  { href: "/#discover", label: "Discover", section: "discover", active: (pathname, section) => pathname === "/" && section === "discover" },
  { href: "/catalog", label: "Catalogue", active: (pathname) => pathname === "/catalog" || pathname.startsWith("/apps/") },
  { href: "/#trust-model", label: "Trust model", section: "trust-model", active: (pathname, section) => pathname === "/" && section === "trust-model" },
  { href: "/download", label: "Get Dapport", active: (pathname) => pathname === "/download", hub: true },
  { href: "/publisher", label: "For publishers", active: (pathname) => pathname.startsWith("/publisher"), publisher: true }
];

export function SiteNavigation({ onboardingEnabled }: Readonly<{ onboardingEnabled: boolean }>) {
  const pathname = usePathname();
  const [homepageSection, setHomepageSection] = useState<HomepageSection>("discover");

  useEffect(() => {
    if (pathname !== "/") return;
    const trustSection = document.getElementById("trust-model");
    if (!trustSection) return;
    const updateActiveSection = () => {
      const probe = window.innerHeight * 0.5;
      const bounds = trustSection.getBoundingClientRect();
      setHomepageSection(bounds.top <= probe && bounds.bottom > probe ? "trust-model" : "discover");
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("hashchange", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("hashchange", updateActiveSection);
    };
  }, [pathname]);

  return (
    <nav aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const active = item.active(pathname, homepageSection);
        const label = item.publisher && !onboardingEnabled ? "Publisher onboarding" : item.label;
        return (
          <Link
            key={item.href}
            className={item.hub ? "hub-nav-link" : item.publisher ? "publisher-link" : undefined}
            href={item.href}
            aria-current={active ? (item.section ? "location" : "page") : undefined}
            onClick={() => item.section && setHomepageSection(item.section)}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
