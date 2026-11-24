"use client";

import type { CatalogChannel } from "@hub/api-client";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { useState, type MouseEventHandler } from "react";
import { categoryLabel, genreLabel } from "../components/catalog-config";
import { appHref } from "./catalog-channel";
import type { CatalogListing } from "./catalog-listings";
import styles from "./Catalog.module.css";

export function CatalogCard({ app, channel, index, onOpen }: {
  app: CatalogListing;
  channel: CatalogChannel;
  index: number;
  onOpen?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const rating = app.solanaMobileRating;
  const description = app.shortDescription ?? app.description;
  const cover = app.coverUrl && failedCover !== app.coverUrl ? app.coverUrl : "/dapport-hero-chromatic.webp";
  const icon = app.iconUrl && failedIcon !== app.iconUrl ? app.iconUrl : "/dapport-app-fallback.png";
  const loading = index < 3 ? "eager" : "lazy";
  return (
    <article className={styles.card}>
      <a className={styles.cardLink} id={`catalog-card-${app.slug}`} href={appHref(app.slug, channel)}
        aria-labelledby={`catalog-name-${app.id}`}
        aria-describedby={[`catalog-info-${app.id}`, description && `catalog-description-${app.id}`].filter(Boolean).join(" ")}
        referrerPolicy="same-origin" onClick={onOpen}>
        <div className={styles.art}>
          <img className={styles.cover} src={cover} alt="" width={800} height={400} decoding="async" loading={loading}
            onError={() => setFailedCover(app.coverUrl)} />
        </div>
        <div className={styles.cardBody}>
          <div className={styles.identity}>
            <img className={styles.appIcon} src={icon} alt="" width={38} height={38} decoding="async" loading={loading}
              onError={() => setFailedIcon(app.iconUrl)} />
            <div className={styles.cardText}>
              <h3 className={styles.cardName} id={`catalog-name-${app.id}`}>{app.name}</h3>
              {description && <p className={styles.tagline} id={`catalog-description-${app.id}`}>{description}</p>}
            </div>
            {rating && rating.reviewCount > 0 && (
              <span className={styles.rating} role="img" aria-label={`${rating.averageRating.toFixed(1)} out of 5 from ${rating.reviewCount.toLocaleString("en-US")} ${rating.reviewCount === 1 ? "review" : "reviews"} on Solana Mobile`}>
                <span className={styles.star} aria-hidden="true">★</span>
                <strong>{rating.averageRating.toFixed(1)}</strong>
                <span className={styles.ratingCount}>({rating.reviewCount.toLocaleString("en-US")})</span>
              </span>
            )}
          </div>
          <div className={styles.cardMeta} id={`catalog-info-${app.id}`}>
            <span className={styles.tag}>{categoryLabel(app.category)}</span>
            {app.genres.length > 0 && <span className={styles.tag}>{app.genres.map(genreLabel).join(" · ")}</span>}
            <span className={styles.storeStatus} data-status={app.visibility}>{app.statusLabel}</span>
            {app.preview && <span className={styles.tag}>Development preview</span>}
            <ArrowRight className={styles.arrow} aria-hidden="true" size={18} />
          </div>
        </div>
      </a>
    </article>
  );
}
