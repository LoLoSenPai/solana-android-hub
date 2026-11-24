"use client";

import { List } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SiteNavigation.module.css";

const sections = [
  { href: "/#apps", label: "Apps" },
  { href: "/publisher", label: "For publishers" }
] as const;

export function SiteNavigation() {
  const pathname = usePathname();
  const onApp = pathname.startsWith("/apps/");
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", closeMenu);
    window.addEventListener("hashchange", closeMenu);
    return () => {
      window.removeEventListener("popstate", closeMenu);
      window.removeEventListener("hashchange", closeMenu);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !mobileMenu.current?.contains(event.target)) closeMenu();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [closeMenu, menuOpen]);

  function sectionLinks() {
    return sections.map(({ href, label }) => {
      const active = href === "/publisher"
        ? pathname === "/publisher" || pathname.startsWith("/publisher/")
        : pathname === "/" || pathname === "/catalog" || onApp || pathname.startsWith("/publishers/");
      return <Link key={href} className={styles.navLink} href={href}
        aria-current={active ? (pathname === href ? "page" : "location") : undefined}
        onClick={closeMenu}>{label}</Link>;
    });
  }
  const MenuIcon = menuOpen ? X : List;

  return (
    <>
      <Link className={styles.wordmark} href="/" aria-label="Dapport home" onNavigate={closeMenu}>
        <Image src="/dapport-mark-512.png" alt="" width={32} height={32} />
        Dapport
      </Link>
      <nav className={styles.primary} aria-label="Main navigation">
        <div className={styles.desktopSections}>{sectionLinks()}</div>
        <Link href="/security" className={styles.navLink} onNavigate={closeMenu}
          aria-label="FAQ & security" aria-current={pathname === "/security" ? "page" : undefined}>
          FAQ<span className={styles.longLabel}>&nbsp;&amp; security</span>
        </Link>
      </nav>
      {onApp
        ? <a className={styles.help} href="#install">How to install</a>
        : <Link className={styles.download} href="/download" onNavigate={closeMenu}
            aria-current={pathname === "/download" ? "page" : undefined}>Get Dapport</Link>}
      <div className={styles.mobile} ref={mobileMenu}
        onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            event.preventDefault();
            closeMenu();
            trigger.current?.focus({ preventScroll: true });
          }
        }}>
        <button ref={trigger} className={styles.menuButton} type="button" aria-label="Site menu"
          aria-controls="site-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
          <MenuIcon size={21} aria-hidden="true" />
        </button>
        <nav id="site-menu" className={styles.menu} aria-label="Site menu" hidden={!menuOpen}>
          {sectionLinks()}
        </nav>
      </div>
    </>
  );
}
