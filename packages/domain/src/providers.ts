import type { ApprovalStatus } from "./types";

export interface VerifiedAppReference {
  appMint: string;
  publisherMint: string;
  packageName: string;
}

export interface DiscoveredRelease {
  releaseMint: string;
  metadataUri: string;
}

export interface AuthorityProof {
  wallet: string;
  appMint: string;
  authorityPath: "update_authority" | "delegated_collection_authority";
  finalizedSlot: bigint;
  evidenceHash: string;
}

export interface ReleaseDiscoveryProvider {
  discoverReleases(app: VerifiedAppReference): Promise<readonly DiscoveredRelease[]>;
}

export interface PublisherAuthorityVerifier {
  verifyAppAuthority(wallet: string, appMint: string): Promise<AuthorityProof>;
}

export interface SolanaMobileApprovalProvider {
  getApprovalStatus(releaseMint: string): Promise<ApprovalStatus>;
}

export interface ApkValidationManifest {
  runId: string;
  apkUrl: string;
  expectedSize: number;
  expectedSha256: string;
  packageName: string;
  versionCode: bigint;
  certificateSha256: string;
}

export interface ApkValidationProvider {
  schedule(manifest: ApkValidationManifest): Promise<void>;
}
