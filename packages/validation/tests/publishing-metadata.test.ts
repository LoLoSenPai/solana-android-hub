import { describe, expect, it } from "vitest";
import { normalizeReleaseMetadata, releaseJsonMetadataSchema } from "../src/index.js";

const digest = "AA:".repeat(31) + "AA";

function releaseFixture() {
  return {
    schema_version: "v0.4.0",
    name: "Hub Test App",
    description: "Fixture",
    image: "https://fixtures.example/icon.png",
    properties: { category: "games", creators: [] },
    extensions: {
      solana_dapp_store: {
        publisher_details: {
          name: "Hub Fixtures",
          website: "https://fixtures.example",
          contact: "contact@fixtures.example",
          support_email: "support@fixtures.example"
        },
        release_details: {
          updated_on: "2026-08-07",
          license_url: "https://fixtures.example/license",
          copyright_url: "Copyright 2026",
          privacy_policy_url: "https://fixtures.example/privacy",
          localized_resources: {
            short_description: "Safe fixture",
            long_description: "Internal installer fixture",
            new_in_version: "First version",
            name: "Hub Test App"
          }
        },
        media: [],
        files: [{
          mime: "application/vnd.android.package-archive",
          purpose: "install",
          size: 1024,
          sha256: digest,
          uri: "https://fixtures.example/app.apk"
        }],
        android_details: {
          android_package: "com.lololabs.hubfixture",
          version_code: 1,
          version: "1.0.0",
          min_sdk: 26,
          target_sdk: 36,
          cert_fingerprint: digest,
          permissions: ["android.permission.INTERNET", "android.permission.INTERNET"],
          locales: ["en-US"]
        }
      },
      i18n: {}
    }
  };
}

describe("release metadata", () => {
  it("normalizes the one install APK and canonical hashes", () => {
    const release = normalizeReleaseMetadata(releaseFixture());
    expect(release.versionCode).toBe(1n);
    expect(release.apkSha256).toBe("aa".repeat(32));
    expect(release.certificateSha256).toBe("aa".repeat(32));
    expect(release.permissions).toEqual(["android.permission.INTERNET"]);
  });

  it("accepts the generic APK MIME type used by the official v0.4.0 example", () => {
    const fixture = releaseFixture();
    fixture.extensions.solana_dapp_store.files[0]!.mime = "application/octet-stream";
    expect(normalizeReleaseMetadata(fixture).apkUri).toBe("https://fixtures.example/app.apk");
  });

  it("requires exactly one recognized install APK", () => {
    const fixture = releaseFixture();
    fixture.extensions.solana_dapp_store.files.push({
      ...fixture.extensions.solana_dapp_store.files[0]!,
      mime: "application/octet-stream",
      uri: "https://fixtures.example/duplicate.apk"
    });
    expect(() => normalizeReleaseMetadata(fixture)).toThrow("exactly one install APK");
  });

  it("rejects non-HTTPS binary locations", () => {
    const fixture = releaseFixture();
    fixture.extensions.solana_dapp_store.files[0]!.uri = "http://fixtures.example/app.apk";
    expect(releaseJsonMetadataSchema.safeParse(fixture).success).toBe(false);
  });

  it("rejects unpinned schema revisions", () => {
    const fixture = releaseFixture();
    fixture.schema_version = "v0.5.0";
    expect(releaseJsonMetadataSchema.safeParse(fixture).success).toBe(false);
  });
});
