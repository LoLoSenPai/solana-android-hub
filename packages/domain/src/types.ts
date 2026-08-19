export type CatalogChannel = "approved" | "trusted";
export const CATALOG_CATEGORIES = [
  "ai-agents",
  "content-streaming",
  "defi",
  "depin",
  "games",
  "lifestyle",
  "nfts",
  "privacy-security",
  "productivity",
  "social-identity",
  "wallets",
  "other"
] as const;
export type CatalogCategory = typeof CATALOG_CATEGORIES[number];
export const GAME_GENRES = [
  "action",
  "adventure",
  "arcade",
  "card",
  "casual",
  "puzzle",
  "rpg",
  "simulation",
  "sports",
  "strategy"
] as const;
export type GameGenre = typeof GAME_GENRES[number];
export const CATALOG_SORTS = ["name", "recently_updated"] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];
export type AppEnvironment = "local" | "staging" | "production";
export type ReleasePolicy = "automatic" | "manual";
export type ApprovalStatus = "unknown" | "verified_approved" | "rejected";
export type ReleaseAuthenticity = "development_preview" | "server_binary_valid";
export const PUBLISHER_LINK_TYPES = ["website", "x", "discord", "telegram"] as const;
export type PublisherLinkType = typeof PUBLISHER_LINK_TYPES[number];

export interface PublisherLinks {
  website: string | null;
  x: string | null;
  discord: string | null;
  telegram: string | null;
}

export const EMPTY_PUBLISHER_LINKS: PublisherLinks = {
  website: null,
  x: null,
  discord: null,
  telegram: null
};

export interface TrustFacts {
  publisherControl: "verified";
  distributionConsent: "active";
  releaseAuthenticity: ReleaseAuthenticity;
  solanaMobileApproval: ApprovalStatus;
}

export interface AppEligibility {
  appMint: string;
  claimStatus: "verified" | "pending" | "suspended" | "revoked";
  authorityCurrent: boolean;
  consentStatus: "active" | "missing" | "revoked" | "superseded";
  consentEnvironment: AppEnvironment;
  distributionEnabled: boolean;
}

export interface ReleaseCandidate {
  id: string;
  releaseMint: string;
  appMint: string;
  packageName: string;
  versionName: string;
  versionCode: bigint;
  certificateSha256: string;
  permissions: readonly string[];
  validationStatus: "discovered" | "metadata_valid" | "server_binary_valid" | "quarantined";
  publicationStatus: "preview" | "unpublished" | "published" | "ignored" | "withdrawn";
  approvalStatus: ApprovalStatus;
}

export interface SelectionContext {
  environment: AppEnvironment;
  channel: CatalogChannel;
  allowedPreviewAppMints: ReadonlySet<string>;
}

export interface InstalledPackageState {
  visibility: "visible" | "unknown";
  versionCode?: bigint;
  certificateSha256?: string;
}

export type UpdateDecision =
  | { kind: "install"; target: ReleaseCandidate }
  | { kind: "update"; target: ReleaseCandidate; installedVersionCode: bigint }
  | { kind: "up_to_date"; target: ReleaseCandidate }
  | { kind: "newer_than_channel"; target: ReleaseCandidate; installedVersionCode: bigint }
  | { kind: "different_edition"; target: ReleaseCandidate }
  | { kind: "compatibility_unknown"; target: ReleaseCandidate; installedVersionCode?: bigint }
  | { kind: "no_release" };

export interface PermissionDiff {
  added: readonly string[];
  removed: readonly string[];
}
