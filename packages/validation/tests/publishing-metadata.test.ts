import { describe, expect, it } from "vitest";
import { appJsonMetadataSchema, normalizeReleaseMetadata, releaseJsonMetadataSchema } from "../src/index.js";

const digest = "AA:".repeat(31) + "AA";

interface ReleaseMediaFixture {
  mime: string;
  purpose: string;
  width: number;
  height: number;
  sha256: string;
  uri: string;
}

function releaseFixture() {
  return {
    schema_version: "0.4.0",
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
        media: [] as ReleaseMediaFixture[],
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
  it("accepts the current portal App NFT metadata shape", () => {
    expect(appJsonMetadataSchema.parse({
      schema_version: "0.4.0",
      name: "DegenMerge",
      description: "DegenMerge - A Solana Mobile dApp",
      image: "https://r2.solanamobiledappstore.com/icon.png",
      attributes: [
        { trait_type: "Type", value: "App" },
        { trait_type: "Publisher", value: "D2FDh5vdxdnnTXaZcHjF3sqoAKt5xTxACgRSVqfZbdrw" }
      ],
      properties: {
        category: "dApp",
        creators: [{ address: "D2FDh5vdxdnnTXaZcHjF3sqoAKt5xTxACgRSVqfZbdrw", share: 100 }]
      },
      extensions: {
        solana_dapp_store: { android_package: "com.loicd.degenmerge.seeker" }
      }
    }).name).toBe("DegenMerge");
  });

  it("normalizes the one install APK and canonical hashes", () => {
    const release = normalizeReleaseMetadata(releaseFixture());
    expect(release.versionCode).toBe(1n);
    expect(release.apkSha256).toBe("aa".repeat(32));
    expect(release.certificateSha256).toBe("aa".repeat(32));
    expect(release.permissions).toEqual(["android.permission.INTERNET"]);
  });

  it("normalizes publisher screenshots, banner, and feature graphic", () => {
    const fixture = releaseFixture();
    fixture.extensions.solana_dapp_store.media = [
      { mime: "image/png", purpose: "screenshot", width: 1080, height: 1920, sha256: digest, uri: "https://fixtures.example/shot.png" },
      { mime: "image/png", purpose: "banner", width: 1200, height: 600, sha256: digest, uri: "https://fixtures.example/banner.png" },
      { mime: "image/png", purpose: "featureGraphic", width: 1200, height: 1200, sha256: digest, uri: "https://fixtures.example/feature.png" }
    ];

    expect(normalizeReleaseMetadata(fixture)).toMatchObject({
      screenshots: ["https://fixtures.example/shot.png"],
      bannerUri: "https://fixtures.example/banner.png",
      featureGraphicUri: "https://fixtures.example/feature.png"
    });
  });

  it("resolves official localized resource identifiers through the preferred release locale", () => {
    const fixture = releaseFixture();
    fixture.extensions.solana_dapp_store.release_details.localized_resources = {
      short_description: "5",
      long_description: "1",
      new_in_version: "2",
      name: "4"
    };
    fixture.extensions.i18n = {
      "fr-FR": { "1": "Description française", "4": "Nom français", "5": "Résumé français" },
      "en-US": { "1": "Full English description", "4": "Localized app name", "5": "English summary" }
    };

    expect(normalizeReleaseMetadata(fixture)).toMatchObject({
      name: "Localized app name",
      description: "Full English description",
      shortDescription: "English summary"
    });
  });

  it("accepts the generic APK MIME type used by the official 0.4.0 example", () => {
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
    fixture.schema_version = "0.5.0";
    expect(releaseJsonMetadataSchema.safeParse(fixture).success).toBe(false);
  });
});
