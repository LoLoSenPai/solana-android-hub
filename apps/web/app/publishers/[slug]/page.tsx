import type { Metadata } from "next";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { listCatalog } from "../../../server/catalog-service";
import { getPublicPublisherProfile } from "../../../server/publisher-profile-service";
import { hubConfig } from "../../../server/runtime";
import { CatalogCard } from "../../catalog/CatalogCard";
import catalogStyles from "../../catalog/Catalog.module.css";
import { catalogChannelFromParam } from "../../catalog/catalog-channel";
import { toCatalogListing } from "../../catalog/catalog-listings";
import { PublisherAvatar } from "../../components/PublisherAvatar";
import { PublisherLinks } from "../../components/PublisherLinks";
import { ShareProfileButton } from "../../components/ShareProfileButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
const readPublicProfile = cache(getPublicPublisherProfile);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await readPublicProfile((await params).slug);
  if (!profile) notFound();
  const name = profile.displayName || "Publisher";
  const description = profile.bio || `Discover Android apps published by ${name} on Dapport, the publisher-authorized home for Solana apps.`;
  const canonical = new URL(`/publishers/${encodeURIComponent(profile.slug)}`, hubConfig.hubOrigin);
  const image = new URL("/dapport-social-card.png", hubConfig.hubOrigin).toString();
  const title = `${name} on Dapport`;
  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: { type: "profile", url: canonical, siteName: "Dapport", title, description, images: [{ url: image, width: 1200, height: 630, alt: "Dapport — Solana apps. Any Android." }] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function PublicPublisherPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const profile = await readPublicProfile(slug);
  if (!profile) notFound();
  const channel = catalogChannelFromParam(query.channel);
  const profilePath = `/publishers/${encodeURIComponent(profile.slug)}`;
  if (slug !== profile.slug) redirect(`${profilePath}${channel === "approved" ? "?channel=approved" : ""}`);
  const apps = await listCatalog({ channel, publisherId: profile.id });
  const name = profile.displayName || "Publisher";

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={channel === "approved" ? "/?channel=approved#apps" : "/#apps"}>
        <ArrowLeft size={18} aria-hidden="true" /> Explore the catalogue
      </Link>
      <section className={styles.hero} aria-labelledby="publisher-name">
        <div className={styles.identity}>
          <PublisherAvatar name={name} url={profile.avatarUrl} className={styles.avatar} />
          <div className={styles.heading}>
            <p className={styles.eyebrow}>Publisher</p>
            <h1 id="publisher-name">{name}</h1>
            {profile.slug !== profile.id ? <p className={styles.handle}>@{profile.slug}</p> : null}
          </div>
        </div>
        <div className={styles.share}><ShareProfileButton url={new URL(profilePath, hubConfig.hubOrigin).toString()} title={`${name} on Dapport`} /></div>
        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        <PublisherLinks links={profile.links} portfolioUrl={profile.portfolioUrl} label={`${name} links`} />
      </section>
      <section className={styles.apps} aria-labelledby="publisher-apps">
        <div className={styles.appsHeading}>
          <h2 id="publisher-apps">Apps <span>{apps.length}</span></h2>
          <p>{channel === "approved" ? "On Solana Mobile" : "Discover this publisher’s apps"}</p>
        </div>
        {apps.length > 0
          ? <div className={catalogStyles.grid}>{apps.map((app, index) => <CatalogCard key={app.id} app={toCatalogListing(app)} channel={channel} index={index} />)}</div>
          : <div className={styles.empty}><h3>No apps available yet</h3><p>{channel === "approved" ? "This publisher has no apps in the Solana Mobile selection yet." : "This publisher’s apps will appear here when they become available."}</p>{channel === "approved" && <Link href={profilePath}>View all available apps <ArrowRight size={18} aria-hidden="true" /></Link>}</div>}
      </section>
    </main>
  );
}
