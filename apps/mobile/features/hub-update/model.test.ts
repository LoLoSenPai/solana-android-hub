import { describe, expect, it } from "vitest";
import { evaluateHubUpdate, parseHubReleaseManifest } from "./model";

const certificate = "a".repeat(64);
const trust = { packageName: "com.lololabs.solanaandroidhub", releaseCertificateSha256: certificate };
const rawManifest = {
  packageName: trust.packageName,
  versionName: "0.3.1",
  versionCode: "4",
  apkUrl: "https://github.com/example/Hub.apk",
  apkSize: 123456,
  apkSha256: "b".repeat(64),
  certificateSha256: certificate,
  minSdk: 26,
  permissions: ["android.permission.INTERNET"],
  releaseNotes: ["Integrated updates"],
  publishedAt: "2026-08-10T18:18:30Z",
  mandatory: false
};

describe("Hub update trust model", () => {
  it("detects a higher signed release", () => {
    const manifest = parseHubReleaseManifest(rawManifest, trust);
    expect(evaluateHubUpdate({
      packageName: trust.packageName,
      versionName: "0.3.0",
      versionCode: "3",
      certificateSha256: certificate
    }, manifest, trust).status).toBe("available");
  });

  it("does not offer the same or an older version", () => {
    const manifest = parseHubReleaseManifest(rawManifest, trust);
    expect(evaluateHubUpdate({
      packageName: trust.packageName,
      versionName: "0.3.1",
      versionCode: "4",
      certificateSha256: certificate
    }, manifest, trust).status).toBe("current");
    expect(evaluateHubUpdate({
      packageName: trust.packageName,
      versionName: "0.4.0",
      versionCode: "5",
      certificateSha256: certificate
    }, manifest, trust).status).toBe("current");
  });

  it("rejects a different package, signer, unsafe URL, or malformed digest", () => {
    expect(() => parseHubReleaseManifest({ ...rawManifest, packageName: "com.attacker.app" }, trust)).toThrow(/package/u);
    expect(() => parseHubReleaseManifest({ ...rawManifest, certificateSha256: "c".repeat(64) }, trust)).toThrow(/signing identity/u);
    expect(() => parseHubReleaseManifest({ ...rawManifest, apkUrl: "http://example.com/Hub.apk" }, trust)).toThrow(/HTTPS/u);
    expect(() => parseHubReleaseManifest({ ...rawManifest, apkSha256: "bad" }, trust)).toThrow(/apkSha256/u);
  });
});
