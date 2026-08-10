import type { CatalogAppDto } from "@hub/api-client";
import type { Metadata } from "next";

const HUB_ORIGIN = "https://solana-hub.lololabs.xyz";

export function buildAppSocialMetadata(app: CatalogAppDto): Metadata {
  const description = app.shortDescription
    ?? app.description
    ?? `Discover ${app.name}, an independently published Android app for the Solana ecosystem.`;
  const pageUrl = new URL(`/apps/${app.slug}`, HUB_ORIGIN);
  const socialImage = app.bannerUrl
    ?? app.featureGraphicUrl
    ?? app.screenshots[0]
    ?? new URL("/hub-hero-chromatic.webp", HUB_ORIGIN).toString();
  const socialTitle = `${app.name} on Solana Android Hub`;

  return {
    title: app.name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Solana Android Hub",
      title: socialTitle,
      description,
      images: [{
        url: socialImage,
        alt: `${app.name} app preview`
      }]
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage]
    }
  };
}
