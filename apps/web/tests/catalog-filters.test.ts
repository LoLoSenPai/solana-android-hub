import type { CatalogAppDto } from "@hub/api-client";
import { CATALOG_CATEGORIES } from "@hub/api-client";
import { describe, expect, it } from "vitest";
import { filterCatalogApps } from "../app/catalog/catalog-filters";
import { catalogListings } from "../app/catalog/catalog-listings";
import { CATEGORIES } from "../app/components/catalog-config";

const puzzle = app("puzzle", "games", ["puzzle"], "2026-08-09T00:00:00.000Z");
const strategy = app("strategy", "games", ["strategy"], "2026-08-08T00:00:00.000Z");
const wallet = app("wallet", "wallets", [], "2026-08-07T00:00:00.000Z");

describe("web catalogue filters", () => {
  it("combines a shareable category and game genre", () => {
    expect(filterCatalogApps([wallet, strategy, puzzle], {
      category: "games",
      genre: "puzzle",
      sort: "recent",
      query: ""
    }).map((item) => item.slug)).toEqual(["puzzle"]);
  });

  it("keeps simple categories free of game genres", () => {
    expect(filterCatalogApps([wallet, strategy, puzzle], {
      category: "wallets",
      genre: "all",
      sort: "recent",
      query: ""
    }).map((item) => item.slug)).toEqual(["wallet"]);
  });

  it("exposes each supported category including Other apps", () => {
    expect(CATEGORIES.map(({ id }) => id).sort()).toEqual(["all", ...CATALOG_CATEGORIES].sort());
    const other = app("other", "other", [], "");
    expect(filterCatalogApps([puzzle, other], { category: "other", genre: "all", sort: "name", query: "" })).toEqual([other]);
  });

  it("can find apps by publisher name, category label, or genre", () => {
    const entry = { ...puzzle, publisher: { id: puzzle.id, slug: "studio", displayName: "Pixel Café" } };
    for (const query of ["pixel cafe", "games", "puzzle"]) {
      expect(filterCatalogApps([entry, wallet], { category: "all", genre: "all", sort: "name", query })).toEqual([entry]);
    }
  });

  it("keeps the artwork and status of an earlier approved release in the approved channel", () => {
    const approved = {
      ...puzzle,
      bannerUrl: "https://example.com/approved.jpg",
      latestRelease: {
        ...puzzle.latestRelease,
        id: "20000000-0000-4000-8000-000000000002",
        trust: { ...puzzle.latestRelease.trust, solanaMobileApproval: "verified_approved" as const }
      }
    };
    const channels = catalogListings({ trusted: [puzzle], approved: [approved] });
    expect(channels.trusted[0]).toMatchObject({ coverUrl: null, visibility: "unknown" });
    expect(channels.approved[0]).toMatchObject({ coverUrl: approved.bannerUrl, visibility: "visible" });
  });
});

function app(id: string, category: CatalogAppDto["category"], genres: CatalogAppDto["genres"], releaseUpdatedAt: string): CatalogAppDto {
  return {
    id: "10000000-0000-4000-8000-00000000000" + ({ puzzle: "1", strategy: "2", wallet: "3" }[id] ?? "4"),
    slug: id,
    appMint: `${id}-mint`,
    name: id,
    shortDescription: `${id} app`,
    description: null,
    iconUrl: null,
    screenshots: [],
    bannerUrl: null,
    featureGraphicUrl: null,
    category,
    genres,
    publisherLinks: { website: null, x: null, discord: null, telegram: null },
    solanaMobileRating: null,
    solanaMobileStore: null,
    releaseUpdatedAt,
    latestRelease: {
      id: "20000000-0000-4000-8000-000000000001",
      releaseMint: `${id}-release`,
      packageName: `com.example.${id}`,
      versionName: "1.0.0",
      versionCode: "1",
      apkUrl: "https://example.com/app.apk",
      apkSize: 1024,
      apkSha256: "a".repeat(64),
      certificateSha256: "b".repeat(64),
      minSdk: 26,
      targetSdk: 36,
      permissions: [],
      previewOnly: false,
      trust: { publisherControl: "verified", distributionConsent: "active", releaseAuthenticity: "server_binary_valid", solanaMobileApproval: "unknown" }
    }
  };
}
