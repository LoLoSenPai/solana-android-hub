"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import { ChartLineUp } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { GameController } from "@phosphor-icons/react/dist/csr/GameController";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Wallet } from "@phosphor-icons/react/dist/csr/Wallet";
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
        {CATEGORIES.map((item, index) => (
          <Link className={`category-card category-${item.tone}`} key={item.id} href={item.id === "all" ? "/catalog" : `/catalog?category=${item.id}`}>
            <span className="category-glyph" aria-hidden="true">{categoryGlyph(item.id)}</span>
            <span className="category-count">{counts[item.id] ?? 0} available</span>
            <strong>{item.label}</strong>
            <span>{item.caption}</span>
            <span className="category-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function categoryGlyph(category: string) {
  const props = { size: 30, weight: "duotone" as const };
  if (category === "games") return <GameController {...props} />;
  if (category === "defi") return <ChartLineUp {...props} />;
  if (category === "wallets") return <Wallet {...props} />;
  if (category === "depin") return <Broadcast {...props} />;
  if (category === "nfts") return <Diamond {...props} />;
  if (category === "privacy-security") return <ShieldCheck {...props} />;
  if (category === "content-streaming") return <Play {...props} />;
  if (category === "productivity") return <Lightning {...props} />;
  if (category === "social-identity") return <UsersThree {...props} />;
  if (category === "ai-agents") return <Sparkle {...props} />;
  if (category === "lifestyle") return <Heart {...props} />;
  return <SquaresFour {...props} />;
}
