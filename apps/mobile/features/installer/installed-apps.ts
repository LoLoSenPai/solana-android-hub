import type { InstalledPackageInfo } from "@hub/app-installer";
import type { LocalInstallRecord } from "../../storage/database";

export interface ConfirmedInstalledApp extends LocalInstallRecord {
  permissionsKnown: boolean;
}

type PackageState = InstalledPackageInfo | { status: "not_installed" | "visibility_unknown" };

// SQLite is installation history, not evidence that an app remains installed.
// This projection never mutates history, including when visibility is unknown.
export async function reconcileInstalledApps(
  records: readonly LocalInstallRecord[],
  getInstalledPackageInfo: (packageName: string) => Promise<PackageState>,
): Promise<readonly ConfirmedInstalledApp[]> {
  const confirmed = await Promise.all(records.map(async (record) => {
    let installed: PackageState;
    try {
      installed = await getInstalledPackageInfo(record.packageName);
    } catch {
      return null;
    }
    if (installed.status !== "installed" || installed.packageName !== record.packageName) return null;
    const permissionsKnown = installed.versionCode === record.versionCode
      && installed.certificateSha256 === record.certificateSha256;
    return {
      ...record,
      versionCode: installed.versionCode,
      versionName: installed.versionName ?? installed.versionCode,
      certificateSha256: installed.certificateSha256,
      permissions: permissionsKnown ? record.permissions : [],
      permissionsKnown,
    };
  }));
  return confirmed.filter((record): record is ConfirmedInstalledApp => record !== null);
}
