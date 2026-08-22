"use client";

import {
  CATALOG_CATEGORIES,
  GAME_GENRES,
  type CatalogAppDto,
  type CatalogCategory,
  type GameGenre
} from "@hub/api-client";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { GameController } from "@phosphor-icons/react/dist/csr/GameController";
import { RocketLaunch } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CATEGORIES, categoryLabel, genreLabel } from "../components/catalog-config";
import { StoreAppCard } from "../components/StoreAppCard";
import { filterCatalogApps, type CatalogSortMode, type CatalogTrustFilter } from "./catalog-filters";

export function CatalogClient({ apps, previewEnvironment }: { apps: readonly CatalogAppDto[]; previewEnvironment: boolean }) {
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
  const trustParam = params.get("trust");
  const trust: CatalogTrustFilter = trustParam === "checked" || (previewEnvironment && trustParam === "preview")
    ? trustParam
    : "all";
  const sort: CatalogSortMode = params.get("sort") === "name" ? "name" : "recent";
  const query = params.get("query") ?? "";

  const filteredApps = useMemo(() => filterCatalogApps(apps, { category, genre, query, sort, trust }), [apps, category, genre, query, sort, trust]);

  const update = (key: string, value: string, defaults: readonly string[] = ["all", "recent", ""]) => {
    const next = new URLSearchParams(params.toString());
    if (defaults.includes(value)) next.delete(key);
    else next.set(key, value);
    if (key === "category" && value !== "games") next.delete("genre");
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
              href={item.id === "all" ? "/catalog" : `/catalog?category=${item.id}`}
              aria-current={category === item.id ? "page" : undefined}
            >{item.label}</Link>
          ))}
        </nav>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <span>Search</span>
            <input type="search" value={query} placeholder={`Search ${heading.toLocaleLowerCase()}`} onChange={(event) => update("query", event.target.value)} />
          </label>
          <label className="select-control"><span>Show</span><span className="select-shell"><select value={trust} onChange={(event) => update("trust", event.target.value)}>
            <option value="all">All available apps</option>
            <option value="checked">Dapport checked</option>
            {previewEnvironment ? <option value="preview">Preview releases</option> : null}
          </select><CaretDown aria-hidden="true" /></span></label>
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
          <div><strong>{filteredApps.length}</strong><span>{filteredApps.length === 1 ? "app" : "apps"}</span></div>
          {filteredApps.length > 0 && (category !== "all" || genre !== "all" || trust !== "all" || query) ? <button type="button" onClick={clear}>Clear filters</button> : null}
        </div>

        {filteredApps.length ? (
          <div className="catalogue-grid">
            {filteredApps.map((app) => <StoreAppCard app={app} key={app.id} />)}
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
