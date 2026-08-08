import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compareObserved, isPublicAddress, validateManifestShape } from "../src/validate.mjs";

const manifest = {
  runId: "02586adf-1c19-47b0-99b6-97b0352dd841",
  apkUrl: "https://downloads.example.com/app.apk",
  expectedSize: 123,
  expectedSha256: "a".repeat(64),
  packageName: "com.example.app",
  versionCode: "2",
  certificateSha256: "b".repeat(64),
  minSdk: 26,
  permissions: ["android.permission.INTERNET"]
};

describe("ephemeral APK validator", () => {
  it("rejects private, loopback, documentation, and link-local addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "203.0.113.1", "::1", "fc00::1", "2001:db8::1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("normalizes permission ordering but keeps the manifest immutable", () => {
    const normalized = validateManifestShape({ ...manifest, permissions: ["z", "a", "a"] });
    expect(normalized.permissions).toEqual(["a", "z"]);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it("returns every binary identity mismatch", () => {
    expect(compareObserved(manifest, {
      byteSize: 1,
      sha256: "c".repeat(64),
      packageName: "com.example.other",
      versionCode: "1",
      certificateSha256: "d".repeat(64),
      minSdk: 24,
      permissions: []
    })).toEqual([
      "APK_SIZE_MISMATCH",
      "APK_HASH_MISMATCH",
      "APK_PACKAGE_MISMATCH",
      "APK_VERSION_MISMATCH",
      "APK_MIN_SDK_MISMATCH",
      "APK_CERTIFICATE_MISMATCH",
      "APK_PERMISSIONS_MISMATCH"
    ]);
  });

  it("pins the GitHub runner to the audited Android 36 inspection tools", async () => {
    const workflow = await readFile(
      new URL("../../../.github/workflows/apk-validator.yml", import.meta.url),
      "utf8"
    );

    expect(workflow).toContain('sdkmanager "build-tools;36.0.0"');
    expect(workflow).toContain('build_tools="$ANDROID_HOME/build-tools/36.0.0"');
    expect(workflow).not.toContain("sort -V | tail -1");
  });
});
