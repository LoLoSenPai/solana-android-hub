"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export function ScreenshotRail({ appName, screenshots }: Readonly<{
  appName: string;
  screenshots: readonly string[];
}>) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, pointerId: -1, startX: 0, scrollLeft: 0 });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: rail.scrollLeft
    };
    rail.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag.active || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    rail.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag.active || event.pointerId !== drag.pointerId) return;
    dragRef.current.active = false;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    railRef.current?.scrollBy({
      left: (event.key === "ArrowRight" ? 1 : -1) * Math.max(280, (railRef.current?.clientWidth ?? 600) * 0.72),
      behavior: "smooth"
    });
  }

  return (
    <div
      ref={railRef}
      className={`screenshot-rail${dragging ? " is-dragging" : ""}`}
      aria-label={`${appName} screenshots`}
      tabIndex={0}
      onKeyDown={handleKeyboard}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      {screenshots.map((screenshot, index) => (
        <img
          key={screenshot}
          src={screenshot}
          alt={`${appName} screenshot ${index + 1}`}
          draggable={false}
        />
      ))}
    </div>
  );
}
