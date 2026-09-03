import type { CatalogAppDto } from "@hub/api-client";
import { describe, expect, it } from "vitest";
import { CATEGORY_DEFINITIONS, filterAndSortApps, localStatusForApp } from "./discovery";
import type { LocalInstallRecord } from "@/storage/database";

const installed: LocalInstallRecord = {
  packageName: "com.example.game",
  appId: "game",
  slug: "game",
  appName: "Orbit Game",
  releaseId: "release-v1",
  versionCode: "1",
  versionName: "1.0.0",
  certificateSha256: "a".repeat(64),
  permissions: [],
  installedAt: 1
};

const game = app({
  id: "game",
  name: "Orbit Game",
  category: "games",
  packageName: "com.example.game",
  versionCode: "2",
  updatedAt: "2026-08-08T00:00:00.000Z",
  authenticity: "server_binary_valid",
  approval: "verified_approved"
});

const wallet = app({
  id: "wallet",
  name: "Key Keeper",
  category: "wallets",
  packageName: "com.example.wallet",
  versionCode: "9",
  updatedAt: "2026-08-01T00:00:00.000Z",
  authenticity: "development_preview",
  approval: "unknown"
});

describe("mobile catalogue discovery", () => {
  it("derives update status only within the installed package", () => {
    expect(localStatusForApp(game, new Map([[installed.packageName, installed]]))).toBe("update");
    expect(localStatusForApp(wallet, new Map([[installed.packageName, installed]]))).toBe("available");
  });

  it("combines category, search, install status, and trust filters", () => {
    const results = filterAndSortApps({
      apps: [wallet, game],
      category: "games",
      query: "orbit",
      availability: "updates",
      trust: "server-checked",
      sort: "recent",
      installedByPackage: new Map([[installed.packageName, installed]])
    });

    expect(results.map((candidate) => candidate.id)).toEqual(["game"]);
  });

  it("sorts by actual release date and never compares version codes across apps", () => {
    const results = filterAndSortApps({
      apps: [wallet, game],
      category: "all",
      query: "",
      availability: "all",
      trust: "all",
      sort: "recent",
      installedByPackage: new Map()
    });

    expect(results.map((candidate) => candidate.id)).toEqual(["game", "wallet"]);
  });

  it("supports consumer-facing newest, oldest, A–Z, and Z–A sorting", () => {
    const base = {
      apps: [wallet, game],
      category: "all" as const,
      query: "",
      availability: "all" as const,
      trust: "all" as const,
      installedByPackage: new Map<string, LocalInstallRecord>()
    };

    expect(filterAndSortApps({ ...base, sort: "recent" }).map((candidate) => candidate.id)).toEqual(["game", "wallet"]);
    expect(filterAndSortApps({ ...base, sort: "oldest" }).map((candidate) => candidate.id)).toEqual(["wallet", "game"]);
    expect(filterAndSortApps({ ...base, sort: "name-asc" }).map((candidate) => candidate.id)).toEqual(["wallet", "game"]);
    expect(filterAndSortApps({ ...base, sort: "name-desc" }).map((candidate) => candidate.id)).toEqual(["game", "wallet"]);
  });

  it("filters Games by genre without affecting simple categories", () => {
    const games = filterAndSortApps({
      apps: [wallet, game],
      category: "games",
      genre: "puzzle",
      query: "",
      availability: "all",
      trust: "all",
      sort: "recent",
      installedByPackage: new Map()
    });
    const wallets = filterAndSortApps({
      apps: [wallet, game],
      category: "wallets",
      genre: "all",
      query: "",
      availability: "all",
      trust: "all",
      sort: "recent",
      installedByPackage: new Map()
    });

    expect(games.map((candidate) => candidate.id)).toEqual(["game"]);
    expect(wallets.map((candidate) => candidate.id)).toEqual(["wallet"]);
  });

  it("does not expose a vague More category in discovery", () => {
    expect(CATEGORY_DEFINITIONS.some((category) => category.id === "other")).toBe(false);
  });
});

function app(input: {
  id: string;
  name: string;
  category: CatalogAppDto["category"];
  packageName: string;
  versionCode: string;
  updatedAt: string;
  authenticity: CatalogAppDto["latestRelease"]["trust"]["releaseAuthenticity"];
  approval: CatalogAppDto["latestRelease"]["trust"]["solanaMobileApproval"];
}): CatalogAppDto {
  const preview = input.authenticity === "development_preview";
  return {
    id: input.id,
    slug: input.id,
    appMint: `${input.id}-mint`,
    name: input.name,
    shortDescription: `${input.name} description`,
    description: null,
    iconUrl: null,
    screenshots: [],
    bannerUrl: null,
    featureGraphicUrl: null,
    category: input.category,
    genres: input.category === "games" ? ["puzzle"] : [],
    publisherLinks: { website: null, x: null, discord: null, telegram: null },
    solanaMobileRating: null,
    releaseUpdatedAt: input.updatedAt,
    latestRelease: {
      id: `${input.id}-release`,
      releaseMint: `${input.id}-release-mint`,
      packageName: input.packageName,
      versionName: input.versionCode,
      versionCode: input.versionCode,
      apkUrl: "https://example.com/app.apk",
      apkSize: 1024,
      apkSha256: "a".repeat(64),
      certificateSha256: "b".repeat(64),
      minSdk: 26,
      targetSdk: 36,
      permissions: [],
      previewOnly: preview,
      trust: {
        publisherControl: "verified",
        distributionConsent: "active",
        releaseAuthenticity: input.authenticity,
        solanaMobileApproval: input.approval
      }
    }
  };
}
