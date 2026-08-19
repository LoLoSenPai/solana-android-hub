import type { CatalogAppDto } from "@hub/api-client";
import { describe, expect, it } from "vitest";
import { filterCatalogApps } from "../app/catalog/catalog-filters";
import { CATEGORIES } from "../app/components/catalog-config";

const puzzle = app("puzzle", "games", ["puzzle"], "2026-08-09T00:00:00.000Z");
const strategy = app("strategy", "games", ["strategy"], "2026-08-08T00:00:00.000Z");
const wallet = app("wallet", "wallets", [], "2026-08-07T00:00:00.000Z");

describe("web catalogue filters", () => {
  it("combines a shareable category and game genre", () => {
    expect(filterCatalogApps([wallet, strategy, puzzle], {
      category: "games",
      genre: "puzzle",
      trust: "all",
      sort: "recent",
      query: ""
    }).map((item) => item.slug)).toEqual(["puzzle"]);
  });

  it("keeps simple categories free of game genres", () => {
    expect(filterCatalogApps([wallet, strategy, puzzle], {
      category: "wallets",
      genre: "all",
      trust: "all",
      sort: "recent",
      query: ""
    }).map((item) => item.slug)).toEqual(["wallet"]);
  });

  it("keeps uncategorized apps in All apps without exposing a vague More category", () => {
    expect(CATEGORIES.some((category) => category.id === "other")).toBe(false);
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
