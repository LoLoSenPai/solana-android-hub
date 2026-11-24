import type { CatalogAppDto } from "@hub/api-client";
import { solanaMobileStatus } from "../components/solana-mobile-status";

export function toCatalogListing(app: CatalogAppDto) {
  const { id, slug, name, shortDescription, description, publisher, category, genres, releaseUpdatedAt, iconUrl, solanaMobileRating } = app;
  const { visibility, label, preview } = solanaMobileStatus(app);
  return {
    id, slug, name, shortDescription, description, publisher, category, genres, releaseUpdatedAt, iconUrl, solanaMobileRating,
    coverUrl: app.bannerUrl ?? app.featureGraphicUrl ?? app.screenshots[0] ?? null,
    visibility, statusLabel: label, preview
  };
}

export type CatalogListing = ReturnType<typeof toCatalogListing>;

export function catalogListings(channels: { trusted: readonly CatalogAppDto[]; approved: readonly CatalogAppDto[] }) {
  // A channel can select an older approved release with different artwork or categories.
  // Reuse equal entries so React only serializes their content once.
  const byRelease = new Map<string, CatalogListing>();
  function listing(app: CatalogAppDto) {
    const record = byRelease.get(app.latestRelease.id) ?? toCatalogListing(app);
    byRelease.set(app.latestRelease.id, record);
    return record;
  }
  return { trusted: channels.trusted.map(listing), approved: channels.approved.map(listing) };
}
