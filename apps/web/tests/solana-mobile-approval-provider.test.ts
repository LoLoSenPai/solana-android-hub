import { describe, expect, it, vi } from "vitest";
import {
  OfficialSolanaMobileApprovalProvider,
  SEEKER_STORE_CONTEXT,
  SOLANA_MOBILE_CATALOG_SOURCE,
  SOLANA_MOBILE_RATING_SOURCE,
  type FetchLike
} from "../server/solana-mobile-approval-provider";

const checkedAt = new Date("2026-08-24T12:00:00.000Z");

describe("Solana Mobile official approval provider", () => {
  it("returns the package version exposed by the consumer catalogue", async () => {
    const fetchImpl = pagedProvider([
      explorePage([{ androidPackage: "com.example.game", versionCode: 2 }]),
      explorePage([])
    ]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);

    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toEqual({
      status: "visible",
      androidPackage: "com.example.game",
      versionCode: 2n,
      checkedAt: checkedAt.toISOString(),
      systemContext: SEEKER_STORE_CONTEXT,
      sourceReference: SOLANA_MOBILE_CATALOG_SOURCE
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
    const body = JSON.parse(init.body) as { query: string };
    expect(body.query).toContain("explore");
    expect(body.query).toContain("androidPackage");
    expect(body.query).toContain("androidDetails { versionCode }");
    expect(body.query).not.toMatch(/description|icon|screenshots|publisherDetails/);
  });

  it("does not treat a package detail record as catalogue visibility", async () => {
    const provider = new OfficialSolanaMobileApprovalProvider(pagedProvider([
      explorePage([{ androidPackage: "com.other.game", versionCode: 8 }]),
      explorePage([])
    ]), () => checkedAt);

    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "not_visible",
      androidPackage: "com.example.game",
      sourceReference: SOLANA_MOBILE_CATALOG_SOURCE
    });
  });

  it("caches one minimal catalogue snapshot for multiple consented packages", async () => {
    const fetchImpl = pagedProvider([
      explorePage([
        { androidPackage: "com.example.one", versionCode: 1 },
        { androidPackage: "com.example.two", versionCode: 4 }
      ]),
      explorePage([])
    ]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);

    await expect(provider.lookupLatestVisibleRelease("com.example.one")).resolves.toMatchObject({ status: "visible", versionCode: 1n });
    await expect(provider.lookupLatestVisibleRelease("com.example.two")).resolves.toMatchObject({ status: "visible", versionCode: 4n });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("preserves prior state by reporting GraphQL and transport failures as unavailable", async () => {
    const graphql = new OfficialSolanaMobileApprovalProvider(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ data: null, errors: [{ message: "error" }] })),
      () => checkedAt
    );
    await expect(graphql.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_GRAPHQL_ERROR"
    });

    const transport = new OfficialSolanaMobileApprovalProvider(
      vi.fn<FetchLike>().mockRejectedValue(new Error("offline")),
      () => checkedAt
    );
    await expect(transport.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_UNAVAILABLE"
    });
  });

  it("rejects malformed provider data", async () => {
    const provider = new OfficialSolanaMobileApprovalProvider(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse(explorePage([{ androidPackage: "com.example.game", versionCode: -1 }]))),
      () => checkedAt
    );
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_INVALID_RESPONSE"
    });
  });

  it("returns the official average and five review buckets for one consented package", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({
      data: {
        dAppByAndroidPackage: {
          androidPackage: "com.example.game",
          rating: { rating: 4.2, reviewsByRating: [0, 1, 3, 4, 8] }
        }
      }
    }));
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);

    await expect(provider.lookupRating("com.example.game")).resolves.toEqual({
      status: "available",
      androidPackage: "com.example.game",
      averageRating: 4.2,
      reviewsByRating: [0, 1, 3, 4, 8],
      checkedAt: checkedAt.toISOString(),
      systemContext: SEEKER_STORE_CONTEXT,
      sourceReference: SOLANA_MOBILE_RATING_SOURCE
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
    const body = JSON.parse(init.body) as { query: string };
    expect(body.query).toContain("dAppByAndroidPackage");
    expect(body.query).toContain("rating { rating reviewsByRating }");
    expect(body.query).not.toMatch(/description|icon|screenshots|publisherDetails|lastRelease/);
  });

  it("normalizes a successful package response with no ratings", async () => {
    const provider = new OfficialSolanaMobileApprovalProvider(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({
        data: {
          dAppByAndroidPackage: {
            androidPackage: "com.example.game",
            rating: null
          }
        }
      })),
      () => checkedAt
    );

    await expect(provider.lookupRating("com.example.game")).resolves.toMatchObject({
      status: "available",
      averageRating: null,
      reviewsByRating: [0, 0, 0, 0, 0]
    });
  });

  it("does not produce a rating update when the detail query fails", async () => {
    const provider = new OfficialSolanaMobileApprovalProvider(
      vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ data: null, errors: [{ message: "error" }] })),
      () => checkedAt
    );

    await expect(provider.lookupRating("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_GRAPHQL_ERROR"
    });
  });
});

function pagedProvider(pages: unknown[]) {
  return vi.fn<FetchLike>().mockImplementation(() => Promise.resolve(jsonResponse(pages.shift() ?? explorePage([]))));
}

function explorePage(apps: Array<{ androidPackage: string; versionCode: number }>) {
  return {
    data: {
      explore: {
        units: {
          edges: [{
            node: {
              __typename: "DAppsByCategoryUnit",
              dApps: {
                edges: apps.map((app) => ({
                  node: {
                    androidPackage: app.androidPackage,
                    lastRelease: { androidDetails: { versionCode: app.versionCode } }
                  }
                }))
              }
            }
          }]
        }
      }
    }
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
