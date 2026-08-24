"use client";

import type { CatalogAppDto, CatalogChannel } from "@hub/api-client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { appHref } from "../catalog/catalog-channel";
import { categoryLabel, genreLabel } from "./catalog-config";

export function StoreAppCard({ app, channel = "trusted" }: { app: CatalogAppDto; channel?: CatalogChannel }) {
  const approval = app.latestRelease.trust.solanaMobileApproval === "verified_approved";
  const artwork = app.featureGraphicUrl ?? app.bannerUrl ?? app.screenshots[0];
  const href = appHref(app.slug, channel);
  return (
    <article className="catalogue-card">
      <Link className="catalogue-card-art" href={href} aria-label={`View ${app.name}`}>
        {artwork
          ? <>
              <img className="catalogue-card-art-backdrop" src={artwork} alt="" aria-hidden="true" />
              <img className="catalogue-card-artwork" src={artwork} alt="" />
            </>
          : <Image className="catalogue-card-artwork" src="/dapport-hero-chromatic.webp" alt="" fill sizes="(max-width: 760px) 100vw, 33vw" />}
        <span className="catalogue-card-category">{categoryLabel(app.category)}</span>
      </Link>
      <div className="catalogue-card-body">
        <div className="catalogue-card-title">
          <AppIcon app={app} />
          <div><h3><Link href={href}>{app.name}</Link></h3><p>{app.shortDescription ?? "Discover this Solana app"}</p></div>
          <Link className="card-action" href={href}>View app</Link>
        </div>
        <div className="catalogue-card-meta">
          {app.genres.map((genre) => <span key={genre}>{genreLabel(genre)}</span>)}
          {approval ? <span className="catalogue-status-solana">On Solana Mobile</span> : null}
          <span className={app.latestRelease.previewOnly ? "catalogue-status-preview" : "catalogue-status-dapport"}>
            {app.latestRelease.previewOnly ? "Development preview" : "Dapport checked"}
          </span>
        </div>
      </div>
    </article>
  );
}

function AppIcon({ app }: { app: CatalogAppDto }) {
  const [failed, setFailed] = useState(false);
  if (!app.iconUrl || failed) {
    return <Image className="catalogue-card-icon" src="/dapport-app-fallback.png" width={160} height={160} alt={`${app.name} icon`} />;
  }
  return <img className="catalogue-card-icon" src={app.iconUrl} alt={`${app.name} icon`} onError={() => setFailed(true)} />;
}
