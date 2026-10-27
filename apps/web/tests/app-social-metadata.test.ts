import { describe, expect, it } from "vitest";
import type { CatalogAppDto } from "@hub/api-client";
import { buildAppSocialMetadata } from "../server/app-social-metadata";

const app = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "degenmerge-5w4yc8k",
  appMint: "5W4YC8kHexample",
  name: "DegenMerge",
  shortDescription: "Drop, merge and evolve magical creatures",
  description: "A longer description.",
  iconUrl: "https://cdn.example.com/icon.png",
  screenshots: ["https://cdn.example.com/screenshot.png"],
  bannerUrl: "https://cdn.example.com/banner.png",
  featureGraphicUrl: "https://cdn.example.com/feature.png",
  category: "games",
  genres: ["puzzle"],
  publisherLinks: { website: "https://degenmerge.example/", x: null, discord: null, telegram: null },
  solanaMobileRating: { averageRating: 4.5, reviewCount: 12, reviewsByRating: [0, 0, 1, 4, 7] },
  solanaMobileStore: null,
  releaseUpdatedAt: "2026-08-09T12:00:00.000Z",
  latestRelease: {
    id: "22222222-2222-4222-8222-222222222222",
    releaseMint: "release-mint",
    packageName: "com.example.degenmerge",
    versionName: "1.0.0",
    versionCode: "1",
    apkUrl: "https://cdn.example.com/app.apk",
    apkSize: 100,
    apkSha256: "a".repeat(64),
    certificateSha256: "b".repeat(64),
    minSdk: 26,
    targetSdk: 36,
    permissions: [],
    previewOnly: true,
    trust: {
      publisherControl: "verified",
      distributionConsent: "active",
      releaseAuthenticity: "development_preview",
      solanaMobileApproval: "unknown"
    }
  }
} satisfies CatalogAppDto;

describe("app social metadata", () => {
  it("builds a canonical rich preview from publisher artwork", () => {
    const metadata = buildAppSocialMetadata(app);

    expect(metadata.title).toBe("DegenMerge");
    expect(metadata.alternates?.canonical).toEqual(new URL("https://dapport.app/apps/degenmerge-5w4yc8k"));
    expect(metadata.openGraph?.title).toBe("DegenMerge on Dapport");
    expect(metadata.openGraph?.images).toEqual([{
      url: "https://cdn.example.com/banner.png",
      alt: "DegenMerge app preview"
    }]);
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://cdn.example.com/banner.png"]
    });
  });

  it("falls back to the branded artwork when publisher artwork is absent", () => {
    const metadata = buildAppSocialMetadata({
      ...app,
      bannerUrl: null,
      featureGraphicUrl: null,
      screenshots: []
    });

    expect(metadata.openGraph?.images).toEqual([{
      url: "https://dapport.app/dapport-social-card.png",
      alt: "DegenMerge app preview"
    }]);
  });
});
