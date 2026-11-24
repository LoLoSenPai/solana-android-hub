"use client";

import { useEffect } from "react";

const panels: Record<string, string> = {
  "#technical": "technical", "#verification": "technical", "#release": "technical",
  "#permissions": "permissions", "#install": "install"
};

export function DetailAnchors() {
  useEffect(() => {
    function open(hash: string) {
      const panel = document.getElementById(panels[hash] ?? "");
      if (!(panel instanceof HTMLDetailsElement)) return;
      panel.open = true;
      panel.scrollIntoView({ block: "start", behavior: "instant" });
      panel.querySelector("summary")?.focus({ preventScroll: true });
    }
    const onHash = () => open(location.hash);
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.origin !== location.origin || anchor.pathname !== location.pathname ||
          anchor.search !== location.search || !Object.hasOwn(panels, anchor.hash)) return;
      event.preventDefault();
      history.replaceState(history.state, "", anchor.hash);
      open(anchor.hash);
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
