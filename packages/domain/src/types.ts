export type CatalogChannel = "approved" | "trusted";
export type AppEnvironment = "local" | "staging" | "production";
export type ReleasePolicy = "automatic" | "manual";
export type ApprovalStatus = "unknown" | "verified_approved" | "rejected";
export type ReleaseAuthenticity = "development_preview" | "server_binary_valid";

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
