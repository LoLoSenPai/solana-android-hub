import type { CatalogAppDto, GameGenre } from "@hub/api-client";
import type { AndroidSymbol } from "expo-symbols";
import type { LocalInstallRecord } from "@/storage/database";

export type CatalogCategory = CatalogAppDto["category"];
export type BrowseCategory = CatalogCategory | "all";
export type AvailabilityFilter = "all" | "not-installed" | "installed" | "updates";
export type TrustFilter = "all" | "approved" | "server-checked" | "preview";
export type BrowseSort = "recent" | "name" | "trust";
export type AppLocalStatus = "available" | "installed" | "update";
export type GenreFilter = "all" | GameGenre;

export interface CategoryDefinition {
  id: BrowseCategory;
  label: string;
  description: string;
  icon: AndroidSymbol;
  accent: string;
}

export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  { id: "all", label: "All apps", description: "The complete catalogue", icon: "apps", accent: "#77A7FF" },
  { id: "games", label: "Games", description: "Play, compete, collect", icon: "sports_esports", accent: "#FFC857" },
  { id: "defi", label: "DeFi & trading", description: "Swap, earn, manage", icon: "finance", accent: "#77A7FF" },
  { id: "depin", label: "DePIN", description: "Networks in the real world", icon: "network_node", accent: "#FF7A59" },
  { id: "wallets", label: "Wallets", description: "Keys and payments", icon: "account_balance_wallet", accent: "#AAA0FF" },
  { id: "social-identity", label: "Social & identity", description: "Profiles and communities", icon: "groups", accent: "#FF8DB3" },
  { id: "ai-agents", label: "AI & agents", description: "Autonomous experiences", icon: "smart_toy", accent: "#80D8FF" },
  { id: "privacy-security", label: "Privacy & security", description: "Safer onchain tools", icon: "shield_lock", accent: "#9EE37D" },
  { id: "nfts", label: "NFTs", description: "Create and collect", icon: "token", accent: "#F7A8FF" },
  { id: "content-streaming", label: "Content", description: "Watch, listen, publish", icon: "play_circle", accent: "#FF9F80" },
  { id: "productivity", label: "Productivity", description: "Tools that get work done", icon: "home_repair_service", accent: "#8FD3FF" },
  { id: "lifestyle", label: "Lifestyle", description: "Everyday onchain apps", icon: "explore", accent: "#FFD580" },
  { id: "other", label: "More", description: "Everything else", icon: "category", accent: "#95A5B7" }
];

export function categoryDefinition(category: string | undefined): CategoryDefinition {
  return CATEGORY_DEFINITIONS.find((candidate) => candidate.id === category) ?? CATEGORY_DEFINITIONS[0]!;
}

export function localStatusForApp(
  app: CatalogAppDto,
  installedByPackage: ReadonlyMap<string, LocalInstallRecord>
): AppLocalStatus {
  const installed = installedByPackage.get(app.latestRelease.packageName);
  if (!installed) return "available";
  return BigInt(app.latestRelease.versionCode) > BigInt(installed.versionCode) ? "update" : "installed";
}

export function filterAndSortApps(input: {
  apps: readonly CatalogAppDto[];
  category: BrowseCategory;
  query: string;
  availability: AvailabilityFilter;
  trust: TrustFilter;
  sort: BrowseSort;
  genre?: GenreFilter;
  installedByPackage: ReadonlyMap<string, LocalInstallRecord>;
}): readonly CatalogAppDto[] {
  const normalizedQuery = input.query.trim().toLocaleLowerCase();
  return input.apps
    .filter((app) => input.category === "all" || app.category === input.category)
    .filter((app) => !input.genre || input.genre === "all" || app.genres.includes(input.genre))
    .filter((app) => {
      if (!normalizedQuery) return true;
      return [app.name, app.shortDescription, app.description]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .filter((app) => {
      const status = localStatusForApp(app, input.installedByPackage);
      if (input.availability === "all") return true;
      if (input.availability === "not-installed") return status === "available";
      if (input.availability === "installed") return status !== "available";
      return status === "update";
    })
    .filter((app) => {
      if (input.trust === "all") return true;
      if (input.trust === "approved") return app.latestRelease.trust.solanaMobileApproval === "verified_approved";
      if (input.trust === "server-checked") return app.latestRelease.trust.releaseAuthenticity === "server_binary_valid";
      return app.latestRelease.previewOnly;
    })
    .sort((left, right) => {
      if (input.sort === "name") return left.name.localeCompare(right.name);
      if (input.sort === "trust") {
        const trustScore = (app: CatalogAppDto) => {
          if (app.latestRelease.trust.solanaMobileApproval === "verified_approved") return 2;
          if (app.latestRelease.trust.releaseAuthenticity === "server_binary_valid") return 1;
          return 0;
        };
        const byTrust = trustScore(right) - trustScore(left);
        if (byTrust !== 0) return byTrust;
      }
      const leftTimestamp = Date.parse(left.releaseUpdatedAt ?? "") || 0;
      const rightTimestamp = Date.parse(right.releaseUpdatedAt ?? "") || 0;
      if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp;
      return right.name.localeCompare(left.name);
    });
}

export function countCategory(apps: readonly CatalogAppDto[], category: BrowseCategory): number {
  return category === "all" ? apps.length : apps.filter((app) => app.category === category).length;
}

export function formatCategory(category: CatalogCategory): string {
  return categoryDefinition(category).label;
}
