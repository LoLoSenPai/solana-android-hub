import { AppInstaller, type InstalledPackageInfo } from "@hub/app-installer";
import Constants from "expo-constants";
import { getHubUpdateCache, setHubUpdateCache } from "@/storage/database";
import {
  evaluateHubUpdate,
  parseHubReleaseManifest,
  type HubReleaseManifest,
  type HubUpdateEvaluation,
  type HubUpdaterTrustConfig
} from "./model";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface HubUpdaterRuntimeConfig extends HubUpdaterTrustConfig {
  enabled: boolean;
  manifestUrl: string;
}

export type HubUpdateCheck =
  | { status: "disabled" }
  | (HubUpdateEvaluation & { checkedAt: number; stale: boolean })
  | { status: "error"; current?: InstalledPackageInfo; message: string };

export async function checkForHubUpdate(options: { force?: boolean } = {}): Promise<HubUpdateCheck> {
  const config = runtimeConfig();
  if (!config.enabled) return { status: "disabled" };
  let current: InstalledPackageInfo | undefined;
  try {
    current = await AppInstaller.getCurrentAppInfo();
    const cached = await getHubUpdateCache();
    const now = Date.now();
    if (!options.force && cached && now - cached.checkedAt < CHECK_INTERVAL_MS) {
      const manifest = parseHubReleaseManifest(cached.manifest, config);
      return { ...evaluateHubUpdate(current, manifest, config), checkedAt: cached.checkedAt, stale: false };
    }
    try {
      const response = await fetch(config.manifestUrl, {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Update service returned HTTP ${response.status}.`);
      const manifest = parseHubReleaseManifest(await response.json(), config);
      await setHubUpdateCache({ checkedAt: now, manifest });
      return { ...evaluateHubUpdate(current, manifest, config), checkedAt: now, stale: false };
    } catch (cause) {
      if (cached) {
        const manifest = parseHubReleaseManifest(cached.manifest, config);
        return { ...evaluateHubUpdate(current, manifest, config), checkedAt: cached.checkedAt, stale: true };
      }
      throw cause;
    }
  } catch (cause) {
    return {
      status: "error",
      ...(current ? { current } : {}),
      message: cause instanceof Error ? cause.message : "Dapport could not check for updates."
    };
  }
}

export function expectedHubUpdateRelease(manifest: HubReleaseManifest) {
  return {
    downloadUrl: manifest.apkUrl,
    byteSize: manifest.apkSize,
    sha256: manifest.apkSha256,
    packageName: manifest.packageName,
    versionCode: manifest.versionCode,
    minSdk: manifest.minSdk,
    certificateSha256: manifest.certificateSha256,
    permissions: manifest.permissions
  } as const;
}

function runtimeConfig(): HubUpdaterRuntimeConfig {
  const value: unknown = Constants.expoConfig?.extra?.hubUpdater;
  if (!isRecord(value)) return disabledConfig();
  const enabled = value.enabled === true;
  const manifestUrl = typeof value.manifestUrl === "string" ? value.manifestUrl : "";
  const packageName = typeof value.packageName === "string" ? value.packageName : "";
  const releaseCertificateSha256 = typeof value.releaseCertificateSha256 === "string" ? value.releaseCertificateSha256 : "";
  if (!enabled || !manifestUrl || !packageName || !releaseCertificateSha256) return disabledConfig();
  return { enabled, manifestUrl, packageName, releaseCertificateSha256 };
}

function disabledConfig(): HubUpdaterRuntimeConfig {
  return { enabled: false, manifestUrl: "", packageName: "", releaseCertificateSha256: "" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
