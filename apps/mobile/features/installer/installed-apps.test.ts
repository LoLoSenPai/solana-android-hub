import type { CatalogAppDto } from "@hub/api-client";
import { describe, expect, it, vi } from "vitest";
import type { LocalInstallRecord } from "../../storage/database";
import { localStatusForApp } from "../catalog/discovery";
import { reconcileInstalledApps } from "./installed-apps";

const history: LocalInstallRecord = {
  packageName: "com.example", appId: "app", slug: "example", appName: "Example",
  releaseId: "release", versionCode: "2", versionName: "2.0", certificateSha256: "cert",
  permissions: ["permission"], installedAt: 123,
};
const app = { latestRelease: { packageName: "com.example", versionCode: "2" } } as CatalogAppDto;
const installed = { status: "installed" as const, packageName: "com.example", versionCode: "2", versionName: "2.0", certificateSha256: "cert" };

describe("Android-confirmed library and catalogue status", () => {
  it.each(["not_installed", "visibility_unknown"] as const)("does not show stale history as Installed when Android reports %s", async (status) => {
    const records = [{ ...history }];
    const confirmed = await reconcileInstalledApps(records, () => Promise.resolve({ status }));
    expect(confirmed).toEqual([]);
    expect(localStatusForApp(app, new Map(confirmed.map((item) => [item.packageName, item])))).toBe("available");
    expect(records).toEqual([history]);
  });

  it("keeps a confirmed installation even if another lookup fails", async () => {
    const records = [history, { ...history, packageName: "com.other" }];
    const query = vi.fn((name: string) => {
      if (name === "com.other") return Promise.reject(new Error("Bridge unavailable"));
      return Promise.resolve(installed);
    });
    const confirmed = await reconcileInstalledApps(records, query);
    expect(confirmed).toEqual([{ ...history, permissionsKnown: true }]);
    expect(localStatusForApp(app, new Map(confirmed.map((item) => [item.packageName, item])))).toBe("installed");
  });

  it("uses the current Android version for Update rather than stale history", async () => {
    const confirmed = await reconcileInstalledApps([history], () => Promise.resolve({ ...installed, versionCode: "1", versionName: "1.0" }));
    expect(confirmed[0]).toMatchObject({ versionCode: "1", versionName: "1.0", permissions: [], permissionsKnown: false });
    expect(localStatusForApp(app, new Map(confirmed.map((item) => [item.packageName, item])))).toBe("update");
    expect(history.versionCode).toBe("2");
    expect(history.permissions).toEqual(["permission"]);
  });

  it("retains the previous installed version after an update is cancelled", async () => {
    const previous = { ...history, versionCode: "1", versionName: "1.0" };
    const confirmed = await reconcileInstalledApps([previous], () => Promise.resolve({ ...installed, versionCode: "1", versionName: "1.0" }));
    expect(confirmed).toEqual([{ ...previous, permissionsKnown: true }]);
    expect(localStatusForApp(app, new Map(confirmed.map((item) => [item.packageName, item])))).toBe("update");
  });

  it("never associates a different package or signer with cached permissions", async () => {
    expect(await reconcileInstalledApps([history], () => Promise.resolve({ ...installed, packageName: "com.other" }))).toEqual([]);
    const confirmed = await reconcileInstalledApps([history], () => Promise.resolve({ ...installed, certificateSha256: "other" }));
    expect(confirmed[0]).toMatchObject({ certificateSha256: "other", permissions: [], permissionsKnown: false });
  });
});
