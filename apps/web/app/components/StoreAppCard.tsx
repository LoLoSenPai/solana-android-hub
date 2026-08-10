"use client";

import type { CatalogAppDto } from "@hub/api-client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { categoryLabel, genreLabel } from "./catalog-config";

export function StoreAppCard({ app }: { app: CatalogAppDto }) {
  const approval = app.latestRelease.trust.solanaMobileApproval === "verified_approved";
  const artwork = app.featureGraphicUrl ?? app.bannerUrl ?? app.screenshots[0];
  return (
    <article className="catalogue-card">
      <Link className="catalogue-card-art" href={`/apps/${app.slug}`} aria-label={`View ${app.name}`}>
        {artwork
          ? <img src={artwork} alt="" />
          : <Image src="/hub-hero.png" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" />}
        <span className="catalogue-card-category">{categoryLabel(app.category)}</span>
      </Link>
      <div className="catalogue-card-body">
        <div className="catalogue-card-title">
          <AppIcon app={app} />
          <div><h3><Link href={`/apps/${app.slug}`}>{app.name}</Link></h3><p>{app.shortDescription ?? "Discover this Solana app"}</p></div>
        </div>
        <div className="catalogue-card-meta">
          {app.genres.map((genre) => <span key={genre}>{genreLabel(genre)}</span>)}
          {approval ? <span>Approved</span> : null}
          <span>{app.latestRelease.previewOnly ? "Preview release" : "Checked release"}</span>
        </div>
        <div className="catalogue-card-footer">
          <span>Android {androidVersion(app.latestRelease.minSdk)}+ · v{app.latestRelease.versionName}</span>
          <Link className="card-action" href={`/apps/${app.slug}`}>View app</Link>
        </div>
      </div>
    </article>
  );
}

function AppIcon({ app }: { app: CatalogAppDto }) {
  const [failed, setFailed] = useState(false);
  if (!app.iconUrl || failed) {
    return <Image className="catalogue-card-icon" src="/hub-app-fallback.png" width={160} height={160} alt={`${app.name} icon`} />;
  }
  return <img className="catalogue-card-icon" src={app.iconUrl} alt={`${app.name} icon`} onError={() => setFailed(true)} />;
}

function androidVersion(minSdk: number): string {
  const versions: Record<number, string> = { 26: "8", 27: "8.1", 28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16" };
  return versions[minSdk] ?? `API ${minSdk}`;
}
