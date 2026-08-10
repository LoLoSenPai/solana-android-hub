import { describe, expect, it } from "vitest";
import { hubReleaseManifestFromEnvironment } from "../server/hub-release-manifest";

const validEnvironment = {
  NEXT_PUBLIC_HUB_ANDROID_APK_VERSION: "0.3.1",
  NEXT_PUBLIC_HUB_ANDROID_APK_VERSION_CODE: "4",
  NEXT_PUBLIC_HUB_ANDROID_APK_URL: "https://github.com/example/releases/download/v0.3.1/Hub.apk",
  NEXT_PUBLIC_HUB_ANDROID_APK_SHA256: "a".repeat(64),
  HUB_ANDROID_APK_SIZE: "109101686",
  HUB_ANDROID_APK_CERTIFICATE_SHA256: "b".repeat(64),
  HUB_ANDROID_APK_PERMISSIONS_JSON: JSON.stringify(["android.permission.INTERNET", "android.permission.REQUEST_INSTALL_PACKAGES"]),
  HUB_ANDROID_APK_RELEASE_NOTES_JSON: JSON.stringify(["Integrated Hub updates."]),
  HUB_ANDROID_APK_PUBLISHED_AT: "2026-08-10T18:18:30+00:00",
  HUB_ANDROID_APK_MANDATORY: "false"
};

describe("Hub release manifest", () => {
  it("normalizes a complete public release", () => {
    expect(hubReleaseManifestFromEnvironment(validEnvironment)).toMatchObject({
      packageName: "com.lololabs.solanaandroidhub",
      versionName: "0.3.1",
      versionCode: "4",
      apkSize: 109101686,
      apkSha256: "A".repeat(64),
      certificateSha256: "B".repeat(64),
      minSdk: 26,
      mandatory: false
    });
  });

  it("fails closed when immutable APK evidence is incomplete", () => {
    expect(hubReleaseManifestFromEnvironment({ ...validEnvironment, HUB_ANDROID_APK_SIZE: undefined })).toBeNull();
    expect(hubReleaseManifestFromEnvironment({ ...validEnvironment, NEXT_PUBLIC_HUB_ANDROID_APK_URL: "http://example.com/Hub.apk" })).toBeNull();
    expect(hubReleaseManifestFromEnvironment({ ...validEnvironment, HUB_ANDROID_APK_PERMISSIONS_JSON: "not-json" })).toBeNull();
  });
});
