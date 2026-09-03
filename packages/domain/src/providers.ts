export interface VerifiedAppReference {
  appMint: string;
  publisherCollectionMint: string | null;
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

export interface OfficialStoreSystemContext {
  locale: string;
  platformSdk: number;
  pixelDensity: number;
  model: string;
}

export type OfficialStoreReleaseLookup =
  | {
      status: "visible";
      androidPackage: string;
      versionCode: bigint;
      checkedAt: string;
      systemContext: OfficialStoreSystemContext;
      sourceReference: string;
    }
  | {
      status: "not_visible";
      androidPackage: string;
      checkedAt: string;
      systemContext: OfficialStoreSystemContext;
      sourceReference: string;
    }
  | {
      status: "unavailable";
      androidPackage: string;
      checkedAt: string;
      errorCode: string;
    };

export interface SolanaMobileApprovalProvider {
  lookupLatestVisibleRelease(androidPackage: string): Promise<OfficialStoreReleaseLookup>;
}

export type OfficialStoreRatingLookup =
  | {
      status: "available";
      androidPackage: string;
      averageRating: number | null;
      reviewsByRating: readonly number[];
      checkedAt: string;
      systemContext: OfficialStoreSystemContext;
      sourceReference: string;
    }
  | {
      status: "unavailable";
      androidPackage: string;
      checkedAt: string;
      errorCode: string;
    };

export interface SolanaMobileRatingProvider {
  lookupRating(androidPackage: string): Promise<OfficialStoreRatingLookup>;
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
