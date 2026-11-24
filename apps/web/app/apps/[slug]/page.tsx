import type { CatalogAppDto, CatalogChannel } from "@hub/api-client";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { buildAppSocialMetadata } from "../../../server/app-social-metadata";
import { getCatalogApp } from "../../../server/catalog-service";
import { getPublicPublisherProfile } from "../../../server/publisher-profile-service";
import { catalogChannelFromParam } from "../../catalog/catalog-channel";
import { categoryLabel, genreLabel } from "../../components/catalog-config";
import { PublisherAvatar } from "../../components/PublisherAvatar";
import { PublisherLinks } from "../../components/PublisherLinks";
import { ScreenshotRail } from "../../components/ScreenshotRail";
import { AppHero } from "./AppHero";
import { AppInfo } from "./AppInfo";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
const readApp = cache((slug: string, channel: CatalogChannel) => getCatalogApp(slug, channel));

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
};

async function listing({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const channel = catalogChannelFromParam(query.channel);
  return { app: await readApp(slug, channel), channel };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { app } = await listing(props);
  return app ? buildAppSocialMetadata(app) : { title: "App unavailable", robots: { index: false, follow: false } };
}

function Rating({ rating }: { rating: CatalogAppDto["solanaMobileRating"] }) {
  if (!rating?.reviewCount) return null;
  const count = rating.reviewCount.toLocaleString("en-US");
  const reviews = rating.reviewCount === 1 ? "review" : "reviews";
  return <span className={styles.rating} aria-label={`${rating.averageRating.toFixed(1)} out of 5 from ${count} ${reviews} on Solana Mobile`}>
    <span aria-hidden="true">★</span> <b>{rating.averageRating.toFixed(1)}</b> · {count} {reviews}
  </span>;
}

export default async function AppDetailPage(props: Props) {
  const { app, channel } = await listing(props);
  if (!app) notFound();
  const profile = app.publisher ? await getPublicPublisherProfile(app.publisher.slug) : null;
  const publisher = profile ?? app.publisher;
  const publisherName = publisher?.displayName || "Publisher";
  const publisherCredit = publisher && <Link className={styles.credit}
    href={`/publishers/${encodeURIComponent(publisher.slug)}${channel === "approved" ? "?channel=approved" : ""}`}
    aria-label={`View ${publisherName}’s publisher profile`}>
    <PublisherAvatar name={publisherName} url={profile?.avatarUrl ?? null} className={styles.avatar} />
    <span><small>Publisher profile</small><strong>{publisherName}</strong></span>
    <CaretRight aria-hidden="true" size={15} />
  </Link>;
  const hasAppLinks = Object.values(app.publisherLinks).some(Boolean);
  const links = hasAppLinks ? app.publisherLinks : profile?.links ?? app.publisherLinks;
  const screenshots = app.screenshots.filter(url => !isVideo(url));
  const videos = app.screenshots.filter(isVideo);
  const cover = app.bannerUrl ?? app.featureGraphicUrl ?? screenshots[0] ?? app.iconUrl ?? "/dapport-hero-chromatic.webp";
  const category = [categoryLabel(app.category), ...app.genres.map(genreLabel)].join(" · ");
  const description = app.description || app.shortDescription;
  const hasPreview = screenshots.length + videos.length > 0;
  return <main className={styles.page}>
    <a className={styles.skip} href={hasPreview ? "#preview" : description ? "#about" : "#app-info-title"}>
      {hasPreview ? "Skip to preview" : "Skip to app details"}
    </a>
    <AppHero name={app.name} category={category} tagline={app.shortDescription} cover={cover}
      icon={app.iconUrl ?? "/dapport-app-fallback.png"} channel={channel}
      credit={publisherCredit} rating={<Rating rating={app.solanaMobileRating} />} />
    <div className={styles.body}>
      <div className={styles.content}>
        {hasPreview && <ScreenshotRail appName={app.name}
          screenshots={screenshots} videos={videos} poster={cover} />}
        {description && <section id="about" className={styles.about} aria-labelledby="about-title">
          <h2 id="about-title">About this app</h2><p>{description}</p>
        </section>}
        {(publisherCredit || hasAppLinks) && <section className={styles.publisher} aria-label="Publisher">
          {publisherCredit || <h2>Publisher links</h2>}
          <PublisherLinks links={links} label={hasAppLinks ? `Publisher links for ${app.name}` : `${publisherName} links`} />
        </section>}
      </div>
      <AppInfo app={app} />
    </div>
  </main>;
}

function isVideo(url: string) {
  return /\.(mp4|m4v|webm|mov|ogv)(?:[?#]|$)/i.test(url);
}
