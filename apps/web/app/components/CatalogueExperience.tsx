import type { CatalogAppDto } from "@hub/api-client";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, categoryLabel } from "./catalog-config";
import { StoreAppCard } from "./StoreAppCard";

export function CatalogueExperience({
  apps,
  previewEnvironment
}: {
  apps: readonly CatalogAppDto[];
  previewEnvironment: boolean;
}) {
  const latest = apps.toSorted(compareRecent)[0];
  const artwork = latest?.bannerUrl ?? latest?.featureGraphicUrl ?? latest?.screenshots[0];
  const categoryCounts = new Map(CATEGORIES.map((category) => [category.id, category.id === "all"
    ? apps.length
    : apps.filter((app) => app.category === category.id).length]));

  return (
    <>
      <section className="catalogue-hero" aria-labelledby="catalogue-title">
        {artwork
          ? <img className="catalogue-hero-art" src={artwork} alt="" />
          : <Image className="catalogue-hero-art" src="/hub-hero.png" alt="" fill priority sizes="(max-width: 760px) 100vw, 1440px" />}
        <div className="catalogue-hero-scrim" aria-hidden="true" />
        <div className="catalogue-hero-copy">
          <p className="eyebrow">Solana apps, made easier to find</p>
          <h1 id="catalogue-title">{latest?.name ?? "Find your next Android app."}</h1>
          <p className="hero-intro">{latest?.shortDescription ?? "Browse games, wallets and everyday Solana apps without getting lost in an endless list."}</p>
          <div className="hero-actions">
            {latest ? <Link className="primary-action" href={`/apps/${latest.slug}`}>Discover {latest.name}</Link> : null}
            <Link className="secondary-action" href="/catalog">Explore the catalogue</Link>
          </div>
        </div>
        {latest ? (
          <Link className="latest-app" href={`/apps/${latest.slug}`}>
            {latest.iconUrl
              ? <img className="latest-app-icon" src={latest.iconUrl} alt="" />
              : <Image className="latest-app-icon" src="/hub-app-fallback.png" width={96} height={96} alt="" />}
            <span><small>{categoryLabel(latest.category)}</small><strong>{latest.name}</strong></span>
            <span className="latest-app-version">v{latest.latestRelease.versionName}</span>
          </Link>
        ) : null}
        {previewEnvironment ? <span className="environment-badge">Early access catalogue</span> : null}
      </section>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="editorial-heading">
          <div>
            <p className="eyebrow">Browse your way</p>
            <h2 id="category-heading">Pick a category.</h2>
          </div>
          <p>Games get useful genre filters. Simpler categories stay simple. Every card opens the full catalogue with the right filter already selected.</p>
        </div>
        <div className="category-grid" aria-label="Catalogue categories">
          {CATEGORIES.map((item) => (
            <Link className={`category-card category-${item.tone}`} key={item.id} href={item.id === "all" ? "/catalog" : `/catalog?category=${item.id}`}>
              <span className="category-count">{categoryCounts.get(item.id) ?? 0} available</span>
              <strong>{item.label}</strong>
              <span>{item.caption}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="discover-section" aria-labelledby="latest-heading">
        <div className="editorial-heading">
          <div><p className="eyebrow">Available now</p><h2 id="latest-heading">Fresh from the catalogue.</h2></div>
          <p>Artwork, a clear promise, and the details people need before deciding what to install.</p>
        </div>
        {apps.length ? <div className="catalogue-grid">{apps.toSorted(compareRecent).slice(0, 4).map((app) => <StoreAppCard app={app} key={app.id} />)}</div> : null}
        <div className="section-action-row"><Link className="primary-action" href="/catalog">See every app and filter</Link></div>
      </section>

      <section className="trust-explainer" id="trust-model" aria-labelledby="trust-heading">
        <div>
          <p className="eyebrow">A safer install path</p>
          <h2 id="trust-heading">Clear checks, plain answers.</h2>
          <p>The Hub keeps its security checks without turning the storefront into a developer dashboard. Open an app’s Safety section whenever you want the evidence.</p>
        </div>
        <ol className="trust-steps">
          <li><span>01</span><strong>Real publisher</strong><small>Current control is checked on Solana.</small></li>
          <li><span>02</span><strong>Permission to list</strong><small>The publisher signs separate distribution consent.</small></li>
          <li><span>03</span><strong>Checked app file</strong><small>The APK is checked before and on your Android device.</small></li>
          <li><span>04</span><strong>Honest approval</strong><small>Solana Mobile approval is shown separately when recorded.</small></li>
        </ol>
      </section>
    </>
  );
}

function compareRecent(left: CatalogAppDto, right: CatalogAppDto): number {
  const leftTime = Date.parse(left.releaseUpdatedAt ?? "") || 0;
  const rightTime = Date.parse(right.releaseUpdatedAt ?? "") || 0;
  return rightTime - leftTime || left.name.localeCompare(right.name);
}
