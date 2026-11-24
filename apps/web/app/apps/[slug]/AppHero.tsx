"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import type { CatalogChannel } from "@hub/api-client";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import styles from "./page.module.css";

type Props = {
  name: string;
  category: string;
  tagline: string | null;
  cover: string;
  icon: string;
  channel: CatalogChannel;
  credit: ReactNode;
  rating: ReactNode;
};

function catalogueEntry() {
  try {
    const localCatalogue = (value: string) => {
      const url = new URL(value);
      return url.origin === location.origin && ["/", "/catalog", "/catalog/"].includes(url.pathname);
    };
    const nav = (window as Window & { navigation?: {
      currentEntry: { index: number };
      entries(): { index: number; url: string | null }[];
    } }).navigation;
    const previous = nav?.entries().find(entry => entry.index === nav.currentEntry.index - 1);
    if (previous?.url) return localCatalogue(previous.url);
    const state = history.state as Record<string, unknown> | null;
    if (state?.fromDapportCatalogue && history.length > 1) return true;
    const marker: unknown = JSON.parse(sessionStorage.getItem("dapportCatalogueNavigation") ?? "null");
    if (!marker || typeof marker !== "object" || !("source" in marker) || typeof marker.source !== "string" ||
        !("destination" in marker) || typeof marker.destination !== "string" ||
        !document.referrer || history.length < 2 || !localCatalogue(marker.source)) return false;
    const source = new URL(marker.source);
    source.hash = "";
    const destination = new URL(marker.destination);
    if (source.href !== document.referrer || destination.origin !== location.origin ||
        destination.pathname !== location.pathname || destination.search !== location.search) return false;
    history.replaceState({ ...state, fromDapportCatalogue: true }, "");
    return true;
  } catch { return false; }
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, fraction: number) => a + (b - a) * fraction;

export function AppHero({ name, category, tagline, cover, icon, channel, credit, rating }: Props) {
  const stageRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [canReturn, setCanReturn] = useState(false);
  const [brokenCover, setBrokenCover] = useState<string | null>(null);
  const [brokenIcon, setBrokenIcon] = useState<string | null>(null);
  const coverSrc = brokenCover === cover ? "/dapport-hero-chromatic.webp" : cover;
  const iconSrc = brokenIcon === icon ? "/dapport-app-fallback.png" : icon;
  const fallback = channel === "approved" ? "/?channel=approved#apps" : "/#apps";

  useLayoutEffect(() => {
    setCanReturn(catalogueEntry());
    const stage = stageRef.current!;
    const start = startRef.current!;
    const spacer = spacerRef.current!;
    const part = (key: string) => stage.querySelector<HTMLElement>(`[data-part="${key}"]`)!;
    const expanded = part("expanded"), title = part("title"), subtitle = part("subtitle");
    const icon = part("icon"), back = part("back"), action = part("action"), extra = part("extra");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const mobileWidth = matchMedia("(max-width: 700px)");
    let frame = 0, previousTime = 0, progress: number | null = null;
    let mounted = true;

    // Offset positions stay stable while transforms move the artwork and text on screen.
    function offset(element: HTMLElement) {
      let x = 0, y = 0;
      for (let node: HTMLElement | null = element; node && node !== stage; node = node.offsetParent as HTMLElement | null) {
        x += node.offsetLeft;
        y += node.offsetTop;
      }
      return { x, y };
    }
    function measure() {
      return {
        mobile: mobileWidth.matches, height: expanded.offsetHeight,
        dock: parseFloat(getComputedStyle(stage).getPropertyValue("--dock")),
        start: start.getBoundingClientRect().top + window.scrollY,
        left: expanded.offsetLeft, icon: offset(icon), title: offset(title), sub: offset(subtitle),
        titleScale: 17 / parseFloat(getComputedStyle(title).fontSize),
        subtitleScale: 13 / parseFloat(getComputedStyle(subtitle).fontSize)
      };
    }
    let bounds = measure();
    function draw(time: number) {
      frame = 0;
      const { height, dock, mobile, left } = bounds;
      const distance = mobile ? 120 : Math.max(1, height - dock);
      const travel = Math.max(0, Math.min(distance, window.scrollY - bounds.start));
      const target = travel / distance;
      if (progress === null || reduced.matches || mobile) progress = target;
      else {
        const elapsed = Math.min(40, Math.max(1, time - previousTime));
        progress = mix(progress, target, 1 - Math.exp(-elapsed / 62));
        if (Math.abs(target - progress) < 0.0005) progress = target;
      }
      previousTime = time;
      const f = progress;
      stage.style.height = `${mix(height, dock, f)}px`;
      spacer.style.height = `${travel}px`;
      stage.style.setProperty("--art-opacity", String(1 - (mobile ? clamp(f / .71) : f)));
      stage.style.setProperty("--art-blur", `${mobile ? 0 : f * 11}px`);
      stage.style.setProperty("--extra-opacity", String(1 - clamp(f / .22)));
      stage.style.setProperty("--compact-opacity", String(clamp((f - .45) / .43)));
      stage.dataset.compact = String(f > .98);
      if (f > .22 && extra.contains(document.activeElement)) back.focus({ preventScroll: true });
      extra.inert = f > .22;
      if (mobile) {
        icon.style.transform = `translate(${-32 * f}px,${(9 - bounds.icon.y) * f}px) scale(${mix(1, .35, f)})`;
        icon.style.opacity = String(1 - clamp(f / .78));
        action.style.bottom = `${mix(6, (dock - action.offsetHeight) / 2, f)}px`;
      } else {
        const x = left + 90;
        const across = 1 - Math.pow(1 - f, 5);
        title.style.transform = `translate(${(x - bounds.title.x) * across}px,${((tagline ? 10 : 22) - bounds.title.y) * f}px) scale(${mix(1, bounds.titleScale, f)})`;
        subtitle.style.transform = `translate(${(x - bounds.sub.x) * across}px,${(33 - bounds.sub.y) * f}px) scale(${mix(1, bounds.subtitleScale, f)})`;
        icon.style.transform = `translate(${(left + 44 - bounds.icon.x) * f}px,${((dock - 34) / 2 - bounds.icon.y) * f}px) scale(${mix(1, 34 / icon.offsetWidth, f)})`;
        action.style.bottom = `${mix(19, (dock - action.offsetHeight) / 2, f)}px`;
      }
      if (progress !== target) frame = requestAnimationFrame(draw);
    }
    function refresh() {
      if (!mounted) return;
      if (frame) cancelAnimationFrame(frame);
      for (const el of [title, subtitle, icon, action]) el.removeAttribute("style");
      bounds = measure();
      progress = null;
      draw(performance.now());
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(draw); }
    const observer = new ResizeObserver(refresh);
    observer.observe(expanded);
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", onScroll, { passive: true });
    reduced.addEventListener("change", refresh);
    void document.fonts.ready.then(refresh);
    refresh();
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", onScroll);
      reduced.removeEventListener("change", refresh);
    };
  }, [name, tagline]);

  function backToApps(event: MouseEvent<HTMLAnchorElement>) {
    if (!canReturn || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.back();
  }

  const backLabel = canReturn ? "Back to apps" : "Explore apps";
  return <>
    <div ref={startRef} />
    <section ref={stageRef} className={styles.stage} aria-label="App overview">
      <div className={styles.backdrop} aria-hidden="true"><img src={coverSrc} alt="" /></div>
      <div className={styles.cover} aria-hidden="true"><img src={coverSrc} alt="" fetchPriority="high" onError={() => setBrokenCover(cover)} /></div>
      <div className={styles.expanded} data-part="expanded">
        <a href={fallback} onClick={backToApps} className={styles.back} aria-label={backLabel} data-part="back">
          <span><ArrowLeft size={18} aria-hidden="true" /></span><b>{backLabel}</b>
        </a>
        <div className={styles.identity}>
          <img className={styles.appIcon} src={iconSrc} alt="" data-part="icon" onError={() => setBrokenIcon(icon)} />
          <span className={styles.category}>{category}</span>
          <h1 className={styles.title} data-part="title">{name}</h1>
          <p className={styles.tagline} data-part="subtitle">{tagline}</p>
          <div className={styles.heroExtra} data-part="extra">{credit}{rating}</div>
        </div>
      </div>
      <div className={styles.compactCopy} aria-hidden="true"><strong>{name}</strong><span>{tagline}</span></div>
      <Link className={styles.install} data-part="action" href="/download">Install with Dapport</Link>
    </section>
    <div ref={spacerRef} aria-hidden="true" />
    <div className={styles.mobileIntro}>
      <h1>{name}</h1>{tagline && <p>{tagline}</p>}{credit}
      <div className={styles.mobileMeta}>{rating}<span>{category}</span></div>
    </div>
  </>;
}
