import type { CatalogAppDto } from "@hub/api-client";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { Compass } from "@phosphor-icons/react/dist/ssr/Compass";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "./catalog-config";
import { CategoryCarousel } from "./CategoryCarousel";
import { StoreAppCard } from "./StoreAppCard";

export function CatalogueExperience({
  apps,
  previewEnvironment
}: {
  apps: readonly CatalogAppDto[];
  previewEnvironment: boolean;
}) {
  const categoryCounts = new Map(CATEGORIES.map((category) => [category.id, category.id === "all"
    ? apps.length
    : apps.filter((app) => app.category === category.id).length]));

  return (
    <>
      <section className="hub-hero" id="discover" aria-labelledby="catalogue-title">
        <Image
          className="hub-hero-art"
          src="/hub-hero-chromatic.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 760px) 100vw, 1440px"
        />
        <div className="hub-hero-scrim" aria-hidden="true" />
        <div className="hub-hero-copy">
          <p className="eyebrow">Solana Android Hub</p>
          <h1 id="catalogue-title">Discover. Install. <span>Android apps on Solana.</span></h1>
          <p className="hero-intro">Browse Solana apps on the web, then install and keep them updated on the Android phone you already own.</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/catalog">Browse the catalogue <span aria-hidden="true">→</span></Link>
            <Link className="signature-action" href="/download"><span>Get the Hub</span><Sparkle aria-hidden="true" weight="fill" /></Link>
          </div>
          <div className="hub-hero-proof" aria-label="How the Hub works">
            <div><Compass aria-hidden="true" /><span><strong>Browse on the web</strong><small>Publisher-provided apps and artwork.</small></span></div>
            <div><DeviceMobile aria-hidden="true" /><span><strong>Install on Android</strong><small>No special Solana phone required.</small></span></div>
            <div><ShieldCheck aria-hidden="true" /><span><strong>Checks you can see</strong><small>Publisher, release and consent stay separate.</small></span></div>
          </div>
        </div>
        <aside className="catalogue-growth-note">
          <span>{apps.length} {apps.length === 1 ? "app" : "apps"} available now</span>
          <strong>The catalogue is growing.</strong>
          <small>New publishers can bring their Android releases to the Hub.</small>
        </aside>
        {previewEnvironment ? <span className="environment-badge">Early access catalogue</span> : null}
      </section>

      <form className="discovery-command" action="/catalog" aria-label="Search the catalogue">
        <label className="command-search">
          <span>Search</span>
          <MagnifyingGlass aria-hidden="true" />
          <input name="query" type="search" placeholder="Search apps, categories or keywords" />
        </label>
        <label className="command-select">
          <span>Category</span>
          <select name="category" defaultValue="all">
            {CATEGORIES.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
          </select>
          <CaretDown aria-hidden="true" />
        </label>
        <label className="command-select">
          <span>Sort</span>
          <select name="sort" defaultValue="recent">
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
          </select>
          <CaretDown aria-hidden="true" />
        </label>
        <button type="submit">Explore</button>
      </form>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="editorial-heading">
          <div>
            <p className="eyebrow">Explore categories</p>
            <h2 id="category-heading">Find your next favorite.</h2>
          </div>
          <div className="category-heading-visual">
            <Image src="/hub-category-orbit.webp" alt="" width={480} height={320} sizes="(max-width: 760px) 45vw, 240px" />
            <p>Jump straight into a category. Games open with genre filters; focused categories stay deliberately simple.</p>
          </div>
        </div>
        <CategoryCarousel counts={Object.fromEntries(categoryCounts)} />
      </section>

      <section className="discover-section" aria-labelledby="latest-heading">
        <div className="editorial-heading">
          <div><p className="eyebrow">Available now</p><h2 id="latest-heading">Open something new.</h2></div>
          <p>Real publisher artwork, a clear promise, and the information you need before deciding what belongs on your phone.</p>
        </div>
        {apps.length ? <div className="catalogue-grid">{apps.toSorted(compareRecent).slice(0, 4).map((app) => <StoreAppCard app={app} key={app.id} />)}</div> : null}
        <div className="section-action-row"><Link className="secondary-action" href="/catalog">See every app and filter <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="how-it-works" aria-labelledby="how-heading">
        <div className="editorial-heading">
          <div><p className="eyebrow">From discovery to updates</p><h2 id="how-heading">One simple Android flow.</h2></div>
          <p>The website helps you choose. The Hub companion app performs the final checks and hands the release to Android.</p>
        </div>
        <ol>
          <li><span>01</span><Compass aria-hidden="true" /><strong>Browse on the web</strong><p>Explore apps, artwork and categories without installing anything first.</p></li>
          <li><span>02</span><DeviceMobile aria-hidden="true" /><strong>Send to Android</strong><p>Open the release with the Hub and validate it on your device.</p></li>
          <li><span>03</span><ArrowsClockwise aria-hidden="true" /><strong>Manage updates</strong><p>Keep Hub-installed apps current without uploading your app inventory.</p></li>
        </ol>
      </section>

      <section className="trust-explainer" id="trust-model" aria-labelledby="trust-heading">
        <div>
          <p className="eyebrow">Openness with visible checks</p>
          <h2 id="trust-heading">You stay in control.</h2>
          <p>Publishers opt in. The Hub does not control your keys, data or funds, and Solana Mobile approval is never implied.</p>
          <Link className="text-link" href="/download">How installation works <span aria-hidden="true">→</span></Link>
        </div>
        <ol className="trust-steps">
          <li><span>01</span><strong>Publisher control</strong><small>Current authority is checked on Solana.</small></li>
          <li><span>02</span><strong>Permission to list</strong><small>Distribution consent is signed separately.</small></li>
          <li><span>03</span><strong>Release identity</strong><small>Package, version, hash and signer must match.</small></li>
          <li><span>04</span><strong>Independent approval</strong><small>Solana Mobile status is shown only when recorded.</small></li>
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
