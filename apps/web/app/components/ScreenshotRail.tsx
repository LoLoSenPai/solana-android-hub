"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ScreenshotRail.module.css";

export function ScreenshotRail({ appName, screenshots, videos = [], poster }: {
  appName: string;
  screenshots: readonly string[];
  videos?: readonly string[];
  poster?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [canPage, setCanPage] = useState({ prev: false, next: false });
  const current = screenshots[index];
  const last = screenshots.length - 1;
  const updateEdges = useCallback(() => {
    if (!rail.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rail.current;
    const prev = scrollLeft >= 2, next = scrollLeft < scrollWidth - clientWidth - 2;
    setCanPage(old => old.prev === prev && old.next === next ? old : { prev, next });
  }, []);

  useEffect(() => {
    const row = rail.current;
    if (!row) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(row);
    for (const tile of row.children) observer.observe(tile);
    updateEdges();
    let drag: { id: number; x: number; y: number; left: number; active: boolean } | null = null;
    function finish(event?: PointerEvent) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const id = drag.id;
      drag = null;
      delete row!.dataset.dragging;
      if (row!.hasPointerCapture(id)) row!.releasePointerCapture(id);
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      if (event.pointerType !== "mouse" || row!.scrollWidth - row!.clientWidth < 3 ||
          !(event.target instanceof Element) || !event.target.closest("button")) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: row!.scrollLeft, active: false };
    }
    function move(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.id) return;
      if (!(event.buttons & 1)) { finish(event); return; }
      const dx = event.clientX - drag.x;
      if (!drag.active) {
        const dy = event.clientY - drag.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
        suppressClick.current = true;
        if (Math.abs(dy) > Math.abs(dx)) { finish(event); return; }
        row!.setPointerCapture(event.pointerId);
        row!.dataset.dragging = "true";
        drag.active = true;
      }
      row!.scrollLeft = drag.left - dx;
    }
    const blur = () => finish();
    row.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    row.addEventListener("lostpointercapture", finish);
    window.addEventListener("blur", blur);
    return () => {
      finish();
      observer.disconnect();
      row.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      row.removeEventListener("lostpointercapture", finish);
      window.removeEventListener("blur", blur);
    };
  }, [screenshots, updateEdges]);

  function scroll(direction: number) {
    const row = rail.current, tile = row?.firstElementChild;
    if (!row || !tile) return;
    const width = tile.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap);
    row.scrollBy({ left: direction * width, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function step(direction: number) {
    const next = Math.max(0, Math.min(last, index + direction));
    const el = document.activeElement;
    if (next === 0 && el?.matches("[data-prev]")) dialog.current?.querySelector<HTMLButtonElement>("[data-next]")?.focus();
    if (next === last && el?.matches("[data-next]")) dialog.current?.querySelector<HTMLButtonElement>("[data-prev]")?.focus();
    setIndex(next);
  }
  return <section id="preview" className={styles.preview} aria-labelledby="preview-title">
    <div className={styles.heading}><h2 id="preview-title">Preview</h2>
      {(canPage.prev || canPage.next) && <div className={styles.arrows}>
        <button type="button" aria-label="Previous previews" disabled={!canPage.prev} onClick={() => scroll(-1)}><ArrowLeft /></button>
        <button type="button" aria-label="Next previews" disabled={!canPage.next} onClick={() => scroll(1)}><ArrowRight /></button>
      </div>}
    </div>
    {screenshots.length > 0 && <div className={styles.rail} ref={rail} onScroll={updateEdges}
      data-scrollable={canPage.prev || canPage.next} onClickCapture={event => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
        }
      }} onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const neighbor = event.key === "ArrowLeft" ? (event.target as HTMLElement).previousElementSibling : (event.target as HTMLElement).nextElementSibling;
        if (neighbor instanceof HTMLButtonElement) { event.preventDefault(); neighbor.focus(); }
      }}>
      {screenshots.map((url, i) => <button className={styles.shot} key={url + i} type="button"
        aria-label={`Enlarge ${appName} screenshot ${i + 1}`} onClick={event => {
          opener.current = event.currentTarget;
          setIndex(i);
          dialog.current?.showModal();
          dialog.current?.querySelector<HTMLButtonElement>("[data-close]")?.focus();
        }}>
        <img src={url} alt="" draggable={false} loading={i > 2 ? "lazy" : "eager"} decoding="async"
          onLoad={event => {
            const img = event.currentTarget;
            img.dataset.orientation = img.naturalWidth > img.naturalHeight ? "landscape" : "portrait";
            updateEdges();
          }} />
      </button>)}
    </div>}
    {videos.map((url, i) => <details className={styles.trailer} key={url} onToggle={event => {
      const player = event.currentTarget.querySelector("video");
      if (!event.currentTarget.open) player?.pause();
    }}>
      <summary>{videos.length === 1 ? "Watch trailer" : `Watch trailer ${i + 1}`}</summary>
      <video src={url} poster={poster} controls playsInline preload="none" aria-label={`${appName} trailer`} />
    </details>)}
    {current && <dialog ref={dialog} className={styles.dialog} aria-labelledby="gallery-title"
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onClose={() => opener.current?.focus({ preventScroll: true })}
      onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); }
      }} onTouchStart={event => {
        const point = event.touches[0];
        touch.current = point && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : null;
      }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
        const point = event.changedTouches[0], start = touch.current;
        touch.current = null;
        if (!start || !point) return;
        const dx = point.clientX - start.x, dy = point.clientY - start.y;
        if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
      }}>
      <div className={styles.viewer}>
        <header><h2 id="gallery-title">{appName} preview</h2><button data-close type="button" aria-label="Close preview" onClick={() => dialog.current?.close()}><X /></button></header>
        <div className={styles.fullImage}><img src={current} alt={`${appName} screenshot ${index + 1}`} /></div>
        <footer><button data-prev type="button" aria-label="Previous screenshot" disabled={index === 0} onClick={() => step(-1)}><ArrowLeft /></button>
          <span aria-live="polite">{index + 1} / {screenshots.length}</span>
          <button data-next type="button" aria-label="Next screenshot" disabled={index === last} onClick={() => step(1)}><ArrowRight /></button>
        </footer>
      </div>
    </dialog>}
  </section>;
}
