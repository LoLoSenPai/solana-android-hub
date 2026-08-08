"use client";

import type { CatalogAppDto, CatalogCategory } from "@hub/api-client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type CategoryId = "all" | CatalogCategory;
type TrustFilter = "all" | "approved" | "production" | "preview";
type SortMode = "name" | "recent";

const categories: readonly {
  id: CategoryId;
  label: string;
  caption: string;
  tone: string;
}[] = [
  { id: "all", label: "All apps", caption: "The complete catalogue", tone: "mint" },
  { id: "defi", label: "DeFi & trading", caption: "Swap, earn and manage", tone: "coral" },
  { id: "games", label: "Games", caption: "Play, collect and compete", tone: "violet" },
  { id: "wallets", label: "Wallets", caption: "Keys, accounts and payments", tone: "blue" },
  { id: "depin", label: "DePIN", caption: "Real-world networks", tone: "sand" },
  { id: "nfts", label: "NFTs", caption: "Collect, create and discover", tone: "slate" },
  { id: "privacy-security", label: "Privacy & security", caption: "Safer tools and private access", tone: "mint" },
  { id: "content-streaming", label: "Content & streaming", caption: "Watch, listen and publish", tone: "coral" },
  { id: "productivity", label: "Productivity", caption: "Get useful things done", tone: "violet" },
  { id: "social-identity", label: "Social & identity", caption: "Communities and profiles", tone: "blue" },
  { id: "ai-agents", label: "AI & agents", caption: "Intelligent onchain tools", tone: "sand" },
  { id: "lifestyle", label: "Lifestyle", caption: "Everyday Solana experiences", tone: "slate" },
  { id: "other", label: "More tools", caption: "Everything else for Android", tone: "mint" }
];

export function CatalogueExperience({
  apps,
  previewEnvironment
}: {
  apps: readonly CatalogAppDto[];
  previewEnvironment: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [trust, setTrust] = useState<TrustFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [androidSdk, setAndroidSdk] = useState("all");

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryId, number>(categories.map((item) => [item.id, 0]));
    counts.set("all", apps.length);
    for (const app of apps) {
      const appCategory = classifyApp(app);
      counts.set(appCategory, (counts.get(appCategory) ?? 0) + 1);
    }
    return counts;
  }, [apps]);

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return apps
      .filter((app) => category === "all" || classifyApp(app) === category)
      .filter((app) => {
        if (!normalizedQuery) return true;
        return [app.name, app.shortDescription, app.description, app.latestRelease.packageName]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      })
      .filter((app) => {
        if (trust === "approved") return app.latestRelease.trust.solanaMobileApproval === "verified_approved";
        if (trust === "production") return app.latestRelease.trust.releaseAuthenticity === "server_binary_valid";
        if (trust === "preview") return app.latestRelease.previewOnly;
        return true;
      })
      .filter((app) => androidSdk === "all" || app.latestRelease.minSdk <= Number(androidSdk))
      .toSorted((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "recent") return compareRecent(left, right);
        return left.name.localeCompare(right.name);
      });
  }, [androidSdk, apps, category, query, sort, trust]);

  const latestEligible = useMemo(
    () => apps.toSorted(compareRecent)[0],
    [apps]
  );

  return (
    <>
      <section className="catalogue-hero" aria-labelledby="catalogue-title">
        <Image className="catalogue-hero-art" src="/hub-hero.png" alt="" fill priority sizes="(max-width: 760px) 100vw, 1440px" />
        <div className="catalogue-hero-copy">
          <p className="eyebrow">Independent Android catalogue</p>
          <h1 id="catalogue-title">Find your next Solana app.</h1>
          <p className="hero-intro">Useful filters, proof-based trust, and a catalogue designed to stay easy to explore as it grows.</p>
          <div className="hero-actions">
            <a className="primary-action" href="#discover">Explore the catalogue</a>
            <a className="secondary-action" href="#trust-model">See how trust works</a>
          </div>
        </div>
        <div className="hero-proof" aria-label="Core product principles">
          <div><strong>4</strong><span>separate trust facts</span></div>
          <div><strong>0</strong><span>broad app-inventory access</span></div>
          <div><strong>1</strong><span>standalone Android store</span></div>
        </div>
        {latestEligible ? (
          <Link className="latest-app" href={`/apps/${latestEligible.slug}`}>
            <AppImage app={latestEligible} className="latest-app-icon" />
            <span><small>Latest eligible release</small><strong>{latestEligible.name}</strong></span>
            <span className="latest-app-version">v{latestEligible.latestRelease.versionName}</span>
          </Link>
        ) : null}
        {previewEnvironment ? <span className="environment-badge">Development preview · never production verified</span> : null}
      </section>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="editorial-heading">
          <div>
            <p className="eyebrow">Browse your way</p>
            <h2 id="category-heading">Start with a category.</h2>
          </div>
          <p>Every category stays searchable, sortable, and filterable—so a growing catalogue never becomes one endless list.</p>
        </div>
        <div className="category-grid" role="group" aria-label="Catalogue categories">
          {categories.map((item) => (
            <button
              className={`category-card category-${item.tone}${category === item.id ? " is-selected" : ""}`}
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
            >
              <span className="category-count">{categoryCounts.get(item.id) ?? 0} available</span>
              <strong>{item.label}</strong>
              <span>{item.caption}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="discover-section" id="discover" aria-labelledby="discover-heading">
        <div className="editorial-heading discover-heading">
          <div>
            <p className="eyebrow">Curated by evidence</p>
            <h2 id="discover-heading">Discover apps.</h2>
          </div>
          <p>Publisher control, APK authenticity, consent, and independent approval are never collapsed into a vague verified badge.</p>
        </div>

        <div className="catalogue-controls" aria-label="Catalogue filters">
          <label className="search-control">
            <span>Search the catalogue</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="App name, purpose or package"
            />
          </label>
          <label>
            <span>Trust state</span>
            <select value={trust} onChange={(event) => setTrust(event.target.value as TrustFilter)}>
              <option value="all">All eligible releases</option>
              <option value="approved">Independently approved</option>
              <option value="production">Server-validated</option>
              {previewEnvironment ? <option value="preview">Development previews</option> : null}
            </select>
          </label>
          <label>
            <span>Device compatibility</span>
            <select value={androidSdk} onChange={(event) => setAndroidSdk(event.target.value)}>
              <option value="all">Any Android version</option>
              <option value="26">Android 8</option>
              <option value="30">Android 11</option>
              <option value="33">Android 13</option>
              <option value="36">Android 16</option>
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="recent">Recently updated</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="active-filter-row">
          <span>{filteredApps.length} {filteredApps.length === 1 ? "app" : "apps"}</span>
          <div className="filter-chips" role="group" aria-label="Quick category filters">
            {categories.map((item) => (
              <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredApps.length > 0 ? (
          <div className="catalogue-grid">
            {filteredApps.map((app) => <AppCard app={app} key={app.id} />)}
          </div>
        ) : (
          <div className="catalogue-empty">
            <p className="eyebrow">No match yet</p>
            <h3>Try a wider filter.</h3>
            <p>The catalogue only shows releases that satisfy the active environment’s publication rules.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("all"); setTrust("all"); setAndroidSdk("all"); }}>Reset filters</button>
          </div>
        )}
      </section>

      <section className="trust-explainer" id="trust-model" aria-labelledby="trust-heading">
        <div>
          <p className="eyebrow">Trust without shortcuts</p>
          <h2 id="trust-heading">Four facts. Four answers.</h2>
          <p>No single badge can tell the whole story. The Hub shows who controls an app, whether distribution was consented to, whether the release binary is authentic, and whether approval was independently verified.</p>
        </div>
        <ol className="trust-steps">
          <li><span>01</span><strong>Publisher control</strong><small>Verified from finalized Solana accounts.</small></li>
          <li><span>02</span><strong>Distribution consent</strong><small>Signed separately for this Hub and environment.</small></li>
          <li><span>03</span><strong>Release authenticity</strong><small>Checked on the server and again on the Android device.</small></li>
          <li><span>04</span><strong>Independent approval</strong><small>Never self-asserted by a publisher.</small></li>
        </ol>
      </section>
    </>
  );
}

function AppCard({ app }: { app: CatalogAppDto }) {
  const approval = app.latestRelease.trust.solanaMobileApproval === "verified_approved";
  return (
    <article className="catalogue-card">
      <Link className="catalogue-card-art" href={`/apps/${app.slug}`} aria-label={`View ${app.name}`}>
        {app.screenshots[0]
          // Publisher screenshot hosts are metadata-driven, so they stay direct instead of enabling a broad Next image proxy allowlist.
          ? <img src={app.screenshots[0]} alt="" />
          : <Image src="/hub-hero.png" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" />}
        <span className="catalogue-card-category">{categoryLabel(classifyApp(app))}</span>
      </Link>
      <div className="catalogue-card-body">
        <div className="catalogue-card-title">
          <AppImage app={app} className="catalogue-card-icon" />
          <div><h3><Link href={`/apps/${app.slug}`}>{app.name}</Link></h3><p>{app.shortDescription ?? app.latestRelease.packageName}</p></div>
        </div>
        <div className="catalogue-card-meta">
          <span>{app.latestRelease.previewOnly ? "Development preview" : "Server-validated release"}</span>
          <span>{approval ? "Independently approved" : "Approval not asserted"}</span>
        </div>
        <div className="catalogue-card-footer">
          <span>Android {androidVersion(app.latestRelease.minSdk)}+ · v{app.latestRelease.versionName}</span>
          <Link className="card-action" href={`/apps/${app.slug}`}>View app</Link>
        </div>
      </div>
    </article>
  );
}

function AppImage({ app, className }: { app: CatalogAppDto; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!app.iconUrl || failed) {
    return <Image className={className} src="/hub-app-fallback.png" width={160} height={160} alt={`${app.name} icon`} />;
  }
  return (
    // Publisher icon hosts are metadata-driven, so they stay direct instead of enabling a broad Next image proxy allowlist.
    <img
      className={className}
      src={app.iconUrl}
      alt={`${app.name} icon`}
      onError={() => setFailed(true)}
    />
  );
}

function classifyApp(app: CatalogAppDto): CatalogCategory {
  return app.category;
}

function categoryLabel(category: CatalogCategory): string {
  return categories.find((item) => item.id === category)?.label ?? "More tools";
}

function compareRecent(left: CatalogAppDto, right: CatalogAppDto): number {
  const leftTime = Date.parse(left.releaseUpdatedAt ?? "");
  const rightTime = Date.parse(right.releaseUpdatedAt ?? "");
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  if (Number.isFinite(rightTime) && !Number.isFinite(leftTime)) return 1;
  if (Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return -1;
  return left.name.localeCompare(right.name);
}

function androidVersion(minSdk: number): string {
  const versions: Record<number, string> = { 26: "8", 27: "8.1", 28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16" };
  return versions[minSdk] ?? `API ${minSdk}`;
}
