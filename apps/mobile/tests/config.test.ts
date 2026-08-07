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
    process.env.EXPO_PUBLIC_HUB_ORIGIN = "https://hub.example.com";
    process.env.RELEASE_PUBLICATION_GATE = "device_only_preview";
    await expect(import("../app.config.js")).rejects.toThrow(/server_and_device/u);
  });

  it("accepts a fail-closed production build without a Play flavor", async () => {
    process.env.APP_ENV = "production";
    process.env.EXPO_PUBLIC_HUB_ORIGIN = "https://hub.example.com";
    process.env.RELEASE_PUBLICATION_GATE = "server_and_device";
    const { default: config } = await import("../app.config.js");
    expect(config.android?.package).toBe("com.lololabs.solanaandroidhub");
    expect(config.extra?.publicationGate).toBe("server_and_device");
    expect(JSON.stringify(config)).not.toContain("playCandidate");
  });

  it("declares only the fixed development fixture query", async () => {
    const path = fileURLToPath(new URL("../modules/app-installer/android/src/main/AndroidManifest.xml", import.meta.url));
    const manifest = await readFile(path, "utf8");
    expect(manifest).not.toContain("QUERY_ALL_PACKAGES");
    expect(manifest.match(/<package /gu)).toHaveLength(1);
    expect(manifest).toContain("com.lololabs.hubfixture");
  });
});
