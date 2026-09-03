import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.resetModules();
});

describe("standalone Android distribution configuration", () => {
  it("ships one package and refuses preview publication in production", async () => {
    process.env.APP_ENV = "production";
    process.env.EXPO_PUBLIC_HUB_ORIGIN = "https://dapport.app";
    process.env.RELEASE_PUBLICATION_GATE = "device_only_preview";
    await expect(import("../app.config.js")).rejects.toThrow(/server_and_device/u);
  });

  it("accepts a fail-closed production build without a Play flavor", async () => {
    process.env.APP_ENV = "production";
    process.env.EXPO_PUBLIC_HUB_ORIGIN = "https://dapport.app";
    process.env.RELEASE_PUBLICATION_GATE = "server_and_device";
    const { default: config } = await import("../app.config.js");
    expect(config.name).toBe("Dapport");
    expect(config.scheme).toBe("dapport");
    expect(config.android?.package).toBe("com.lololabs.solanaandroidhub");
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe("./assets/adaptive-icon.png");
    expect(config.android?.adaptiveIcon?.monochromeImage).toBe("./assets/monochrome-icon.png");
    expect(config.version).toBe("0.5.6");
    expect(config.android?.versionCode).toBe(13);
    expect(config.android?.blockedPermissions).toEqual([
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE"
    ]);
    expect(config.extra?.publicationGate).toBe("server_and_device");
    expect(config.extra?.hubUpdater).toEqual({
      enabled: true,
      manifestUrl: "https://dapport.app/api/v1/hub/releases/latest",
      packageName: "com.lololabs.solanaandroidhub",
      releaseCertificateSha256: "02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09"
    });
    expect(JSON.stringify(config)).not.toContain("playCandidate");
  });

  it("allows explicit version overrides for reproducible update-path fixtures", async () => {
    process.env.APP_ENV = "production";
    process.env.EXPO_PUBLIC_HUB_ORIGIN = "https://dapport.app";
    process.env.RELEASE_PUBLICATION_GATE = "server_and_device";
    process.env.HUB_APP_VERSION_NAME = "0.3.0";
    process.env.HUB_APP_VERSION_CODE = "3";
    const { default: config } = await import("../app.config.js");
    expect(config.version).toBe("0.3.0");
    expect(config.android?.versionCode).toBe(3);
  });

  it("declares only the fixed development fixture query", async () => {
    const path = fileURLToPath(new URL("../modules/app-installer/android/src/main/AndroidManifest.xml", import.meta.url));
    const manifest = await readFile(path, "utf8");
    expect(manifest).not.toContain("QUERY_ALL_PACKAGES");
    expect(manifest.match(/<package /gu)).toHaveLength(1);
    expect(manifest).toContain("com.lololabs.hubfixture");
  });

  it("keeps the self-update API in the native module and verifies it in release APKs", async () => {
    const modulePath = fileURLToPath(new URL("../modules/app-installer/android/src/main/java/com/lololabs/hub/installer/AppInstallerModule.kt", import.meta.url));
    const builderPath = fileURLToPath(new URL("../../../tooling/android/build-production.ps1", import.meta.url));
    const [moduleSource, builderSource] = await Promise.all([
      readFile(modulePath, "utf8"),
      readFile(builderPath, "utf8")
    ]);
    expect(moduleSource).toContain('AsyncFunction("getCurrentAppInfo")');
    expect(builderSource).toContain('"getCurrentAppInfo"');
    expect(builderSource).toContain("Assert-ApkDexContains");
  });
});
