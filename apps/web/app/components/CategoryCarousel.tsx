"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES } from "./catalog-config";

export function CategoryCarousel({ counts }: Readonly<{ counts: Readonly<Record<string, number>> }>) {
  const railRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(true);

  const updateControls = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanGoBack(rail.scrollLeft > 8);
    setCanGoForward(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateControls();
    const observer = new ResizeObserver(updateControls);
    observer.observe(rail);
    rail.addEventListener("scroll", updateControls, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", updateControls);
    };
  }, [updateControls]);

  const scrollByPage = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.82, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div className="category-carousel">
      <div className="category-carousel-toolbar">
        <span id="category-carousel-help">Drag to explore</span>
        <div>
          <button type="button" onClick={() => scrollByPage(-1)} disabled={!canGoBack} aria-label="Previous categories">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollByPage(1)} disabled={!canGoForward} aria-label="Next categories">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={railRef}
        className="category-rail"
        aria-label="Catalogue categories"
        aria-describedby="category-carousel-help"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const rail = railRef.current;
          if (!rail) return;
          pointerRef.current = { active: true, moved: false, startX: event.clientX, startScroll: rail.scrollLeft };
          rail.setPointerCapture(event.pointerId);
          rail.classList.add("is-dragging");
        }}
        onPointerMove={(event) => {
          const rail = railRef.current;
          const pointer = pointerRef.current;
          if (!rail || !pointer.active) return;
          const distance = event.clientX - pointer.startX;
          if (Math.abs(distance) > 5) pointer.moved = true;
          rail.scrollLeft = pointer.startScroll - distance;
        }}
        onPointerUp={(event) => {
          const rail = railRef.current;
          if (!rail) return;
          pointerRef.current.active = false;
          if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
          rail.classList.remove("is-dragging");
        }}
        onPointerCancel={() => {
          pointerRef.current.active = false;
          railRef.current?.classList.remove("is-dragging");
        }}
        onClickCapture={(event) => {
          if (!pointerRef.current.moved) return;
          event.preventDefault();
          event.stopPropagation();
          pointerRef.current.moved = false;
        }}
      >
        {CATEGORIES.map((item) => (
          <Link className={`category-card category-${item.tone}`} key={item.id} href={item.id === "all" ? "/catalog" : `/catalog?category=${item.id}`}>
            <span className="category-card-media" aria-hidden="true">
              <span className="category-glyph">
                <Image src={`/category-icons/${item.id}.webp`} alt="" width={256} height={256} sizes="104px" />
              </span>
            </span>
            <span className="category-card-body">
              <span className="category-count">{counts[item.id] ?? 0} available</span>
              <strong>{item.label}</strong>
              <span className="category-caption">{item.caption}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
