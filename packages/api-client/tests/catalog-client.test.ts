import { describe, expect, it } from "vitest";
import { catalogAppDtoSchema, HubApiClient } from "../src/index.js";

const legacyItem = {
  id: "10000000-0000-4000-8000-000000000003",
  slug: "test-app",
  appMint: "22222222222222222222222222222222",
  name: "Test App",
  shortDescription: null,
  description: null,
  iconUrl: null,
  screenshots: [],
  bannerUrl: null,
  featureGraphicUrl: null,
  latestRelease: {
    id: "20000000-0000-4000-8000-000000000001",
    releaseMint: "44444444444444444444444444444444",
    packageName: "com.example.test",
    versionName: "1.0.0",
    versionCode: "1",
    apkUrl: "https://example.com/app.apk",
    apkSize: 1024,
    apkSha256: "a".repeat(64),
    certificateSha256: "b".repeat(64),
    minSdk: 26,
    targetSdk: 36,
    permissions: [],
    previewOnly: false,
    trust: {
      publisherControl: "verified",
      distributionConsent: "active",
      releaseAuthenticity: "server_binary_valid",
      solanaMobileApproval: "unknown"
    }
  }
};

describe("catalog API client", () => {
  it("parses legacy catalogue items with safe category defaults", () => {
    expect(catalogAppDtoSchema.parse(legacyItem)).toMatchObject({
      category: "other",
      genres: [],
      publisherLinks: { website: null, x: null, discord: null, telegram: null },
      solanaMobileRating: null,
      releaseUpdatedAt: null
    });
  });

  it("parses the official rating aggregate without any review text", () => {
    expect(catalogAppDtoSchema.parse({
      ...legacyItem,
      solanaMobileRating: {
        averageRating: 4.2,
        reviewCount: 16,
        reviewsByRating: [0, 1, 3, 4, 8]
      }
    }).solanaMobileRating).toEqual({
      averageRating: 4.2,
      reviewCount: 16,
      reviewsByRating: [0, 1, 3, 4, 8]
    });
  });

  it("sends category, genre, sort, channel, search, and Android SDK filters", async () => {
    let requestedUrl = "";
    const fetchImpl = ((input: RequestInfo | URL) => {
      requestedUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      return Promise.resolve(new Response(JSON.stringify({
        items: [{
          ...legacyItem,
          category: "games",
          genres: ["arcade"],
          releaseUpdatedAt: "2026-08-08T00:00:00.000Z"
        }],
        nextCursor: null,
        requestId: "request-1"
      }), { status: 200, headers: { "content-type": "application/json" } }));
    }) as typeof fetch;

    const client = new HubApiClient("https://hub.example", fetchImpl);
    const response = await client.getCatalog({
      channel: "approved",
      query: "arcade",
      category: "games",
      sort: "recently_updated",
      androidSdk: 36,
      genre: "arcade"
    });

    const url = new URL(requestedUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      channel: "approved",
      query: "arcade",
      category: "games",
      sort: "recently_updated",
      androidSdk: "36",
      genre: "arcade"
    });
    expect(response.items[0]?.category).toBe("games");
  });
});
