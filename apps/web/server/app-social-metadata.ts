import type { CatalogAppDto } from "@hub/api-client";
import type { Metadata } from "next";

const DAPPORT_ORIGIN = "https://dapport.app";

export function buildAppSocialMetadata(app: CatalogAppDto): Metadata {
  const description = app.shortDescription
    ?? app.description
    ?? `Discover ${app.name}, an independently published Android app for the Solana ecosystem.`;
  const pageUrl = new URL(`/apps/${app.slug}`, DAPPORT_ORIGIN);
  const socialImage = app.bannerUrl
    ?? app.featureGraphicUrl
    ?? app.screenshots[0]
    ?? new URL("/dapport-social-card.png", DAPPORT_ORIGIN).toString();
  const socialTitle = `${app.name} on Dapport`;

  return {
    title: app.name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Dapport",
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
