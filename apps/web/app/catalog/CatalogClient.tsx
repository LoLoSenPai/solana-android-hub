"use client";

import {
  CATALOG_CATEGORIES,
  GAME_GENRES,
  type CatalogAppDto,
  type CatalogCategory,
  type CatalogChannel,
  type GameGenre
} from "@hub/api-client";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { GameController } from "@phosphor-icons/react/dist/csr/GameController";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { RocketLaunch } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CATEGORIES, categoryLabel, genreLabel } from "../components/catalog-config";
import { StoreAppCard } from "../components/StoreAppCard";
import { catalogHref } from "./catalog-channel";
import { filterCatalogApps, type CatalogSortMode } from "./catalog-filters";

export function CatalogClient({ apps, channel }: { apps: readonly CatalogAppDto[]; channel: CatalogChannel }) {
  const router = useRouter();
  const params = useSearchParams();
  const categoryParam = params.get("category");
  const category: "all" | CatalogCategory = CATALOG_CATEGORIES.includes(categoryParam as CatalogCategory)
    ? categoryParam as CatalogCategory
    : "all";
  const genreParam = params.get("genre");
  const genre: "all" | GameGenre = category === "games" && GAME_GENRES.includes(genreParam as GameGenre)
    ? genreParam as GameGenre
    : "all";
  const sort: CatalogSortMode = params.get("sort") === "name" ? "name" : "recent";
  const view = params.get("view") === "list" ? "list" : "grid";
  const query = params.get("query") ?? "";

  const filteredApps = useMemo(() => filterCatalogApps(apps, { category, genre, query, sort }), [apps, category, genre, query, sort]);

  const update = (key: string, value: string, defaults: readonly string[] = ["all", "recent", ""]) => {
    const next = new URLSearchParams(params.toString());
    if (defaults.includes(value)) next.delete(key);
    else next.set(key, value);
    if (key === "category" && value !== "games") next.delete("genre");
    router.replace(next.size ? `/catalog?${next.toString()}` : "/catalog", { scroll: false });
  };

  const setApprovedOnly = (approvedOnly: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (approvedOnly) next.set("channel", "approved");
    else next.delete("channel");
    router.replace(next.size ? `/catalog?${next.toString()}` : "/catalog", { scroll: false });
  };

  const clear = () => router.replace("/catalog", { scroll: false });
  const heading = category === "all" ? "All apps" : categoryLabel(category);

  return (
    <>
      <section className="catalog-page-heading">
        <div>
          <p className="eyebrow">Explore Android {category === "games" ? "games" : "apps"}</p>
          <h1>{heading}</h1>
          <p>{category === "games" ? "Puzzle, strategy, RPG and casual games—without the endless, unfiltered list." : "Find what belongs on your Android phone without wading through technical metadata."}</p>
        </div>
        <Link className="catalog-android-callout" href="/download">
          {category === "games" ? <GameController aria-hidden="true" weight="duotone" /> : <DeviceMobile aria-hidden="true" weight="duotone" />}
          <span><strong>{category === "games" ? "Install and play on Android" : "Take your catalogue to Android"}</strong><small>Use Dapport to validate, install and manage releases.</small></span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="catalog-workspace" aria-label="App catalogue">
        <nav className="catalog-category-nav" aria-label="App categories">
          {CATEGORIES.map((item) => (
            <Link
              key={item.id}
              href={catalogHref({ channel, category: item.id, view })}
              aria-current={category === item.id ? "page" : undefined}
            >{item.label}</Link>
          ))}
        </nav>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <span>Search</span>
            <input type="search" value={query} placeholder={`Search ${heading.toLocaleLowerCase()}`} onChange={(event) => update("query", event.target.value)} />
          </label>
          <label className="catalog-channel-toggle">
            <span>Availability</span>
            <span className="catalog-channel-toggle-control">
              <input type="checkbox" checked={channel === "approved"} onChange={(event) => setApprovedOnly(event.target.checked)} />
              <span aria-hidden="true" />
              <strong>Solana Mobile approved only</strong>
            </span>
          </label>
          <label className="select-control"><span>Sort</span><span className="select-shell"><select value={sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
          </select><CaretDown aria-hidden="true" /></span></label>
        </div>

        {category === "games" ? (
          <div className="genre-filter" role="group" aria-label="Game genres">
            <span>Genre</span>
            <button type="button" aria-pressed={genre === "all"} onClick={() => update("genre", "all")}>All genres</button>
            {GAME_GENRES.map((item) => <button type="button" key={item} aria-pressed={genre === item} onClick={() => update("genre", item)}>{genreLabel(item)}</button>)}
          </div>
        ) : null}

        <div className="catalog-results-heading">
          <div className="catalog-results-count"><strong>{filteredApps.length}</strong><span>{filteredApps.length === 1 ? "app" : "apps"}</span></div>
          <div className="catalog-results-actions">
            {filteredApps.length > 0 && (category !== "all" || genre !== "all" || channel === "approved" || query) ? <button className="catalog-clear-filters" type="button" onClick={clear}>Clear filters</button> : null}
            <div className="catalog-view-toggle" role="group" aria-label="Catalogue layout">
              <button type="button" aria-label="Compact grid" aria-pressed={view === "grid"} onClick={() => update("view", "grid", ["grid"])}><SquaresFour aria-hidden="true" /></button>
              <button type="button" aria-label="List" aria-pressed={view === "list"} onClick={() => update("view", "list", ["grid"])}><ListBullets aria-hidden="true" /></button>
            </div>
          </div>
        </div>

        {filteredApps.length ? (
          <div className={`catalogue-grid${view === "list" ? " catalogue-grid-list" : ""}`}>
            {filteredApps.map((app) => <StoreAppCard app={app} channel={channel} key={app.id} />)}
            <aside className="catalogue-growing-card">
              <RocketLaunch aria-hidden="true" weight="duotone" />
              <p className="eyebrow">Catalogue in progress</p>
              <h3>{category === "games" ? "More games are on the way." : "More apps are joining Dapport."}</h3>
              <p>Publishers can opt in as their Android releases become available.</p>
              <Link href="/publisher">For publishers <span aria-hidden="true">→</span></Link>
            </aside>
          </div>
        ) : (
          <div className="catalogue-empty"><p className="eyebrow">No match yet</p><h3>Try a wider filter.</h3><p>Clear one filter to see more apps.</p><button type="button" onClick={clear}>Clear filters</button></div>
        )}
      </section>
    </>
  );
}
