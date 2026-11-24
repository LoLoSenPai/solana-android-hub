"use client";

import { CATALOG_CATEGORIES, GAME_GENRES, type CatalogCategory, type CatalogChannel } from "@hub/api-client";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CATEGORIES, categoryLabel, genreLabel } from "../components/catalog-config";
import { CatalogCard } from "./CatalogCard";
import styles from "./Catalog.module.css";
import { filterCatalogApps } from "./catalog-filters";
import type { CatalogListing } from "./catalog-listings";

const PAGE_SIZE = 12;
type FilterKey = "query" | "category" | "genre" | "sort" | "channel" | "view";

type CataloguePosition = { url: string; shown: number; scrollY: number; focusKey: string };
type CatalogState = { dapportCatalogue?: CataloguePosition };

export function CatalogClient({ channels }: {
  channels: Record<CatalogChannel, readonly CatalogListing[]>;
}) {
  const params = useSearchParams();
  const category = CATALOG_CATEGORIES.find((id) => id === params.get("category")) ?? "all";
  const genre = category === "games" ? GAME_GENRES.find((id) => id === params.get("genre")) ?? "all" : "all";
  const sort = params.get("sort") === "name" ? "name" : "recent";
  const view = params.get("view") === "list" ? "list" : "grid";
  const channel: CatalogChannel = params.get("channel") === "approved" ? "approved" : "trusted";
  const query = params.get("query") ?? "";

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDetailsElement>(null);
  const categoryToggle = useRef<HTMLButtonElement>(null);
  const filtered = useMemo(() => filterCatalogApps(channels[channel], { category, genre, sort, query }),
    [channels, channel, category, genre, sort, query]);
  const shown = filtered.slice(0, limit);
  const hasFilters = Boolean(query || category !== "all" || channel === "approved" || sort === "name" || view === "list");
  const emptyCategory = category !== "all" && !channels.trusted.some((app) => app.category === category);
  const emptyInventory = emptyCategory || !channels.trusted.length;
  const total = `${filtered.length} ${filtered.length === 1 ? "app" : "apps"}`;
  const categoryName = category === "all" ? "All apps" : categoryLabel(category);

  useLayoutEffect(() => {
    let active = true;
    const restore = () => {
      const saved = (history.state as CatalogState | null)?.dapportCatalogue;
      if (!saved || saved.url !== location.href) return;
      setLimit(Math.max(PAGE_SIZE, saved.shown));
      void document.fonts.ready.then(() => requestAnimationFrame(() => {
        if (!active) return;
        document.getElementById(`catalog-card-${saved.focusKey}`)?.focus({ preventScroll: true });
        window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      }));
    };
    restore();
    window.addEventListener("pageshow", restore);
    return () => {
      active = false;
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  useEffect(() => {
    const handleLegacyHash = () => {
      if (location.hash === "#trust-model") location.replace("/security");
    };
    const closeOutside = (event: PointerEvent) => {
      if (panel.current?.open && event.target instanceof Node && !panel.current.contains(event.target)) panel.current.open = false;
    };
    handleLegacyHash();
    window.addEventListener("hashchange", handleLegacyHash);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("hashchange", handleLegacyHash);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  useEffect(() => {
    if (search.current && search.current.value !== query) search.current.value = query;
  }, [query]);

  const apply = (changes: Partial<Record<FilterKey, string>>) => {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    setLimit(PAGE_SIZE);
    // Next synchronizes useSearchParams through the native history API, without a server request per keystroke.
    history.replaceState(null, "", url);
  };
  const clear = () => {
    apply({ category: "", genre: "", query: "", sort: "", channel: "", view: "" });
    search.current?.focus({ preventScroll: true });
  };
  const chooseCategory = (id: CatalogCategory | "all") => {
    apply({ category: id === "all" ? "" : id, ...(id === "games" ? {} : { genre: "" }) });
    setMobileCategoriesOpen(false);
    if (window.matchMedia("(max-width: 620px)").matches) categoryToggle.current?.focus();
  };
  const remember = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const saved: CataloguePosition = { url: location.href, shown: shown.length, scrollY: window.scrollY, focusKey: slug };
    history.replaceState({ ...history.state as CatalogState | null, dapportCatalogue: saved }, "");
    const source = new URL(location.href);
    source.hash = "";
    try {
      sessionStorage.setItem("dapportCatalogueNavigation", JSON.stringify({ source: source.href, destination: event.currentTarget.href }));
    } catch { /* Browser history still restores the catalogue when storage is disabled. */ }
  };

  return (
    <section className={styles.section} id="apps" aria-labelledby="apps-title" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector("summary")?.focus();
      } else if (mobileCategoriesOpen) {
        setMobileCategoriesOpen(false);
        categoryToggle.current?.focus();
      }
    }}>
      <header className={styles.heading}>
        <h2 id="apps-title">Apps</h2>
        <div className={styles.controls}>
          <label className={styles.search}>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <input ref={search} type="search" aria-label="Search apps" placeholder="Search" autoComplete="off" maxLength={100}
              defaultValue={query} onChange={(event) => apply({ query: event.target.value })} />
          </label>
          <details ref={panel} className={styles.filters}>
            <summary className={channel === "approved" || sort === "name" || view === "list" ? styles.hasFilters : undefined}>
              <SlidersHorizontal size={18} aria-hidden="true" /> Filters
            </summary>
            <div className={styles.filterPanel}>
              <label className={styles.sort}>Sort by
                <select value={sort} onChange={(event) => apply({ sort: event.target.value === "name" ? "name" : "" })}>
                  <option value="recent">Recently updated</option><option value="name">Name A–Z</option>
                </select>
              </label>
              <label className={styles.approved}>
                <input type="checkbox" checked={channel === "approved"}
                  onChange={(event) => apply({ channel: event.target.checked ? "approved" : "" })} />
                <span>Solana Mobile approved only</span>
              </label>
              <label className={styles.sort}>Layout
                <select value={view} onChange={(event) => apply({ view: event.target.value === "list" ? "list" : "" })}>
                  <option value="grid">Grid</option><option value="list">List</option>
                </select>
              </label>
            </div>
          </details>
        </div>
      </header>

      <div className={styles.categoryPicker}>
        <button type="button" ref={categoryToggle} className={styles.categoryToggle} aria-controls="app-categories"
          aria-expanded={mobileCategoriesOpen} onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}>
          <span>Categories</span><strong>{categoryName}</strong><CaretDown size={18} aria-hidden="true" />
        </button>
        <div className={styles.categories} id="app-categories" data-open={mobileCategoriesOpen} role="group" aria-label="App categories">
          {CATEGORIES.map(({ id, label }) => (
            <button key={id} type="button" className={styles.category} aria-pressed={id === category} onClick={() => chooseCategory(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className={styles.results}>
        <p className={styles.count} role="status" aria-atomic="true">{shown.length < filtered.length ? `Showing ${shown.length} of ${total}` : total}</p>
        <div className={styles.resultActions}>
          {filtered.length > 0 && hasFilters && <button className={styles.reset} type="button" onClick={clear}>Clear filters</button>}
          {category === "games" && <label className={styles.genres}>Genre
            <select value={genre} onChange={(event) => apply({ genre: event.target.value === "all" ? "" : event.target.value })}>
              <option value="all">All genres</option>
              {GAME_GENRES.map((id) => <option key={id} value={id}>{genreLabel(id)}</option>)}
            </select>
          </label>}
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <div className={styles.grid} id="app-grid" data-layout={view}>
            {shown.map((app, index) => <CatalogCard key={app.id} app={app} channel={channel} index={index} onOpen={(event) => remember(event, app.slug)} />)}
          </div>
          {shown.length < filtered.length && <div className={styles.pagination}>
            <button type="button" className={styles.more} aria-controls="app-grid" onClick={() => {
              const next = filtered[shown.length];
              setLimit(limit + PAGE_SIZE);
              if (next) requestAnimationFrame(() => document.getElementById(`catalog-card-${next.slug}`)?.focus());
            }}>Show more apps</button>
          </div>}
        </>
      ) : (
        <div className={styles.empty}>
          <h3>{emptyCategory ? `No apps in ${categoryName} yet` : emptyInventory ? "No apps on Dapport yet" : "No matching apps"}</h3>
          <p>{emptyInventory ? "Publishers can opt in to list their apps on Dapport." : "Try another search or clear the filters."}</p>
          <div className={styles.emptyActions}>
            {emptyInventory && <Link className={styles.publish} href="/publisher">Publish on Dapport <ArrowRight size={18} aria-hidden="true" /></Link>}
            {hasFilters && <button type="button" className={styles.reset} onClick={clear}>{emptyInventory ? "Browse all apps" : "Clear filters"}</button>}
          </div>
        </div>
      )}
    </section>
  );
}
