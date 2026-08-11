export interface HubReleaseManifest {
  packageName: string;
  versionName: string;
  versionCode: string;
  apkUrl: string;
  apkSize: number;
  apkSha256: string;
  certificateSha256: string;
  minSdk: number;
  permissions: readonly string[];
  releaseNotes: readonly string[];
  publishedAt: string;
  mandatory: boolean;
}

export interface HubUpdaterTrustConfig {
  packageName: string;
  releaseCertificateSha256: string;
}

export interface CurrentHubInstallation {
  packageName: string;
  versionName: string | null;
  versionCode: string;
  certificateSha256: string;
}

export type HubUpdateEvaluation =
  | { status: "current"; current: CurrentHubInstallation; manifest: HubReleaseManifest }
  | { status: "available"; current: CurrentHubInstallation; manifest: HubReleaseManifest };

export function parseHubReleaseManifest(input: unknown, trust: HubUpdaterTrustConfig): HubReleaseManifest {
  if (!isRecord(input)) throw new Error("The Dapport update manifest is not an object.");
  const packageName = stringField(input, "packageName");
  const certificateSha256 = digestField(input, "certificateSha256");
  if (packageName !== trust.packageName) throw new Error("The Dapport update package does not match this app.");
  if (certificateSha256 !== normalizeDigest(trust.releaseCertificateSha256)) {
    throw new Error("The Dapport update signing identity does not match this app.");
  }
  const apkUrl = stringField(input, "apkUrl");
  const parsedUrl = new URL(apkUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || (parsedUrl.port && parsedUrl.port !== "443")) {
    throw new Error("The Dapport update URL is not safe HTTPS.");
  }
  const versionCode = stringField(input, "versionCode");
  if (!/^[1-9][0-9]*$/u.test(versionCode)) throw new Error("The Dapport update version code is invalid.");
  const apkSize = numberField(input, "apkSize");
  if (!Number.isSafeInteger(apkSize) || apkSize < 1 || apkSize > 500 * 1024 * 1024) {
    throw new Error("The Dapport update size is invalid.");
  }
  const minSdk = numberField(input, "minSdk");
  if (!Number.isInteger(minSdk) || minSdk < 26 || minSdk > 36) throw new Error("The Dapport update Android requirement is invalid.");
  const publishedAt = stringField(input, "publishedAt");
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error("The Dapport update publication date is invalid.");
  return {
    packageName,
    versionName: stringField(input, "versionName"),
    versionCode,
    apkUrl: parsedUrl.toString(),
    apkSize,
    apkSha256: digestField(input, "apkSha256"),
    certificateSha256,
    minSdk,
    permissions: stringArrayField(input, "permissions"),
    releaseNotes: stringArrayField(input, "releaseNotes"),
    publishedAt,
    mandatory: booleanField(input, "mandatory")
  };
}

export function evaluateHubUpdate(
  current: CurrentHubInstallation,
  manifest: HubReleaseManifest,
  trust: HubUpdaterTrustConfig
): HubUpdateEvaluation {
  if (current.packageName !== trust.packageName) throw new Error("The installed Dapport package is not eligible for this update channel.");
  if (normalizeDigest(current.certificateSha256) !== normalizeDigest(trust.releaseCertificateSha256)) {
    throw new Error("The installed Dapport signing identity is not eligible for this update channel.");
  }
  const currentVersion = BigInt(current.versionCode);
  const targetVersion = BigInt(manifest.versionCode);
  return targetVersion > currentVersion
    ? { status: "available", current, manifest }
    : { status: "current", current, manifest };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Dapport update field ${field} is invalid.`);
  return value.trim();
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number") throw new Error(`Dapport update field ${field} is invalid.`);
  return value;
}

function booleanField(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== "boolean") throw new Error(`Dapport update field ${field} is invalid.`);
  return value;
}

function stringArrayField(record: Record<string, unknown>, field: string): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Dapport update field ${field} is invalid.`);
  }
  return value.map((item) => (item as string).trim());
}

function digestField(record: Record<string, unknown>, field: string): string {
  const digest = normalizeDigest(stringField(record, field));
  if (!/^[a-f0-9]{64}$/u.test(digest)) throw new Error(`Dapport update field ${field} is invalid.`);
  return digest;
}

function normalizeDigest(value: string): string {
  return value.replaceAll(":", "").trim().toLowerCase();
}
