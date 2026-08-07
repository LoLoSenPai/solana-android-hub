import type {
  AppEligibility,
  InstalledPackageState,
  PermissionDiff,
  ReleaseCandidate,
  SelectionContext,
  UpdateDecision
} from "./types";

export function isAppEligible(app: AppEligibility, environment: SelectionContext["environment"]): boolean {
  return app.claimStatus === "verified"
    && app.authorityCurrent
    && app.consentStatus === "active"
    && app.consentEnvironment === environment
    && app.distributionEnabled;
}

export function isReleaseEligible(release: ReleaseCandidate, context: SelectionContext): boolean {
  if (release.validationStatus === "quarantined" || release.publicationStatus === "withdrawn") return false;

  const isProductionEligible = context.environment === "production"
    && release.validationStatus === "server_binary_valid"
    && release.publicationStatus === "published";

  const isPreviewEligible = context.environment !== "production"
    && context.allowedPreviewAppMints.has(release.appMint)
    && (release.validationStatus === "metadata_valid" || release.validationStatus === "server_binary_valid")
    && (release.publicationStatus === "preview" || release.publicationStatus === "published");

  if (!isProductionEligible && !isPreviewEligible) return false;
  return context.channel === "trusted" || release.approvalStatus === "verified_approved";
}

export function selectLatestRelease(
  releases: readonly ReleaseCandidate[],
  context: SelectionContext
): ReleaseCandidate | undefined {
  return releases
    .filter((release) => isReleaseEligible(release, context))
    .toSorted((left, right) => left.versionCode === right.versionCode
      ? left.releaseMint.localeCompare(right.releaseMint)
      : left.versionCode > right.versionCode ? -1 : 1)[0];
}

export function computeUpdateDecision(
  target: ReleaseCandidate | undefined,
  installed: InstalledPackageState | undefined
): UpdateDecision {
  if (!target) return { kind: "no_release" };
  if (!installed) return { kind: "install", target };
  if (installed.visibility === "unknown") {
    return installed.versionCode === undefined
      ? { kind: "compatibility_unknown", target }
      : { kind: "compatibility_unknown", target, installedVersionCode: installed.versionCode };
  }
  if (installed.certificateSha256 !== undefined
    && normalizeFingerprint(installed.certificateSha256) !== normalizeFingerprint(target.certificateSha256)) {
    return { kind: "different_edition", target };
  }
  if (installed.versionCode === undefined) return { kind: "compatibility_unknown", target };
  if (target.versionCode > installed.versionCode) {
    return { kind: "update", target, installedVersionCode: installed.versionCode };
  }
  if (target.versionCode === installed.versionCode) return { kind: "up_to_date", target };
  return { kind: "newer_than_channel", target, installedVersionCode: installed.versionCode };
}

export function diffPermissions(current: readonly string[], target: readonly string[]): PermissionDiff {
  const currentSet = new Set(current);
  const targetSet = new Set(target);
  return {
    added: [...targetSet].filter((permission) => !currentSet.has(permission)).toSorted(),
    removed: [...currentSet].filter((permission) => !targetSet.has(permission)).toSorted()
  };
}

export function quarantineReason(
  previous: ReleaseCandidate | undefined,
  candidate: ReleaseCandidate,
  initialBackfill = false
): "package_changed" | "certificate_changed" | "version_regression" | undefined {
  if (!previous) return undefined;
  if (previous.packageName !== candidate.packageName) return "package_changed";
  if (normalizeFingerprint(previous.certificateSha256) !== normalizeFingerprint(candidate.certificateSha256)) {
    return "certificate_changed";
  }
  if (!initialBackfill && candidate.versionCode <= previous.versionCode) return "version_regression";
  return undefined;
}

export function normalizeFingerprint(value: string): string {
  return value.replaceAll(":", "").toLowerCase();
}
