import { describe, expect, it } from "vitest";
import { hubReleaseManifestFromEnvironment } from "../server/hub-release-manifest";

const validEnvironment = {
  NEXT_PUBLIC_HUB_ANDROID_APK_VERSION: "0.3.1",
  NEXT_PUBLIC_HUB_ANDROID_APK_VERSION_CODE: "4",
  NEXT_PUBLIC_HUB_ANDROID_APK_URL: "https://github.com/LoLoSenPai/solana-android-hub-releases/releases/download/v0.3.1/Solana-Android-Hub-v0.3.1.apk",
  NEXT_PUBLIC_HUB_ANDROID_APK_SHA256: "064BF912E728493B61462083F4252886235AAB8602FBA34F574BD2CB2F8BFDCA",
  HUB_ANDROID_APK_SIZE: "109123658",
  HUB_ANDROID_APK_CERTIFICATE_SHA256: "02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09",
  HUB_ANDROID_APK_PERMISSIONS_JSON: JSON.stringify([
    "android.permission.INTERNET",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.VIBRATE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "com.lololabs.solanaandroidhub.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
  ]),
  HUB_ANDROID_APK_RELEASE_NOTES_JSON: JSON.stringify([
    "The Hub now checks for updates automatically.",
    "A new Settings control lets you check and install updates.",
    "Hub updates reuse the full on-device APK validation flow."
  ]),
  HUB_ANDROID_APK_PUBLISHED_AT: "2026-08-10T20:19:51Z",
  HUB_ANDROID_APK_MANDATORY: "false"
};

describe("Hub release manifest", () => {
  it("normalizes a complete public release", () => {
    expect(hubReleaseManifestFromEnvironment(validEnvironment)).toMatchObject({
      packageName: "com.lololabs.solanaandroidhub",
      versionName: "0.3.1",
      versionCode: "4",
      apkSize: 109123658,
      apkSha256: "064BF912E728493B61462083F4252886235AAB8602FBA34F574BD2CB2F8BFDCA",
      certificateSha256: "02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09",
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
