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

  it("finishes a catalogue with more than thirty pages and retains early and late releases", async () => {
    const fetchImpl = pagedProvider([
      ...Array.from({ length: 32 }, (_, index) => explorePage([
        { androidPackage: `com.example.page${index}`, versionCode: index + 1 }
      ])),
      explorePage([])
    ]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);

    await expect(provider.lookupLatestVisibleRelease("com.example.page0")).resolves.toMatchObject({ status: "visible", versionCode: 1n });
    await expect(provider.lookupLatestVisibleRelease("com.example.page31")).resolves.toMatchObject({ status: "visible", versionCode: 32n });
    await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "not_visible" });
    expect(fetchImpl).toHaveBeenCalledTimes(33);
    const requestBody = fetchImpl.mock.calls[31]?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("Expected a JSON request body");
    expect((JSON.parse(requestBody) as { query: string }).query).toContain('after: "620"');
  });

  it("uses official pageInfo to finish a nonempty final page", async () => {
    const fetchImpl = pagedProvider([explorePage([{ androidPackage: "com.example.game", versionCode: 3 }], false)]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ status: "visible", versionCode: 3n });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("continues while any category has another page and keeps the highest duplicated version", async () => {
    const first = explorePage([{ androidPackage: "com.example.game", versionCode: 7 }], false);
    first.data.explore.units.edges.push(...explorePage([{ androidPackage: "com.example.game", versionCode: 3 }], true).data.explore.units.edges);
    const final = explorePage([{ androidPackage: "com.example.next", versionCode: 2 }], false);
    final.data.explore.units.edges.push(...explorePage([{ androidPackage: "com.example.game", versionCode: null }], false).data.explore.units.edges);
    const fetchImpl = pagedProvider([first, final]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ status: "visible", versionCode: 7n });
    await expect(provider.lookupLatestVisibleRelease("com.example.next")).resolves.toMatchObject({ status: "visible", versionCode: 2n });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("bounds an endlessly growing catalogue without publishing the partial snapshot", async () => {
    let page = 0;
    const fetchImpl = vi.fn<FetchLike>().mockImplementation(() => Promise.resolve(jsonResponse(explorePage([
      { androidPackage: `com.example.page${page++}`, versionCode: 1 }
    ]))));
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.page0")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_CATALOG_LIMIT_REACHED" });
    expect(fetchImpl).toHaveBeenCalledTimes(1_000);
  });

  it("counts raw packages without release details and does not stop before the next page", async () => {
    const fetchImpl = pagedProvider([
      explorePage([{ androidPackage: "com.example.noRelease", versionCode: null }]),
      explorePage([{ androidPackage: "com.example.game", versionCode: 5 }], false)
    ]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ status: "visible", versionCode: 5n });
    await expect(provider.lookupLatestVisibleRelease("com.example.noRelease")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_RELEASE_UNAVAILABLE" });
  });

  it("accepts a final raw page without release details without claiming its package is absent", async () => {
    const fetchImpl = pagedProvider([explorePage([{ androidPackage: "com.example.noRelease", versionCode: null }], false)]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.noRelease")).resolves.toMatchObject({ status: "unavailable" });
    await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "not_visible" });
  });

  it("fails closed when pagination repeats packages or advertises another empty page", async () => {
    for (const pages of [
      [explorePage([{ androidPackage: "com.example.game", versionCode: 1 }]), explorePage([{ androidPackage: "com.example.game", versionCode: 1 }])],
      [explorePage([], true)]
    ]) {
      const fetchImpl = pagedProvider(pages);
      const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);
      await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_CATALOG_NOT_PROGRESSING" });
      expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(2);
    }
  });

  it("shares concurrent and failed crawls, caches errors briefly, then retries the whole catalogue", async () => {
    let now = checkedAt.getTime();
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(explorePage([{ androidPackage: "com.example.first", versionCode: 1 }])))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse(explorePage([{ androidPackage: "com.example.recovered", versionCode: 2 }], false)));
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => new Date(now));
    const results = await Promise.all([
      provider.lookupLatestVisibleRelease("com.example.first"),
      provider.lookupLatestVisibleRelease("com.example.absent")
    ]);
    expect(results.map((result) => result.status)).toEqual(["unavailable", "unavailable"]);
    now += 29_999;
    await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    now += 1;
    await expect(provider.lookupLatestVisibleRelease("com.example.recovered")).resolves.toMatchObject({ status: "visible", versionCode: 2n });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("expires successful catalogue snapshots after five minutes", async () => {
    let now = checkedAt.getTime();
    const fetchImpl = pagedProvider([
      explorePage([{ androidPackage: "com.example.game", versionCode: 1 }], false),
      explorePage([{ androidPackage: "com.example.game", versionCode: 2 }], false)
    ]);
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => new Date(now));
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ versionCode: 1n });
    now += 299_999;
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ versionCode: 1n });
    now += 1;
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ versionCode: 2n });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("discards and briefly caches a crawl exceeding the total deadline before retrying", async () => {
    let now = checkedAt.getTime();
    const fetchImpl = vi.fn<FetchLike>()
      .mockImplementationOnce(() => {
        now += 45_000;
        return Promise.resolve(jsonResponse(explorePage([{ androidPackage: "com.example.game", versionCode: 1 }], false)));
      })
      .mockResolvedValueOnce(jsonResponse(explorePage([{ androidPackage: "com.example.game", versionCode: 2 }], false)));
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => new Date(now));
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_CATALOG_TIMEOUT" });
    now += 29_999;
    await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_CATALOG_TIMEOUT" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 1;
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({ status: "visible", versionCode: 2n });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not interpret a response missing pagination metadata as a complete catalogue", async () => {
    const page = explorePage([{ androidPackage: "com.example.game", versionCode: 1 }]);
    const json = JSON.stringify(page).replace('"pageInfo":{"hasNextPage":true},', "");
    const provider = new OfficialSolanaMobileApprovalProvider(pagedProvider([JSON.parse(json)]), () => checkedAt);
    await expect(provider.lookupLatestVisibleRelease("com.example.absent")).resolves.toMatchObject({ status: "unavailable", errorCode: "OFFICIAL_PROVIDER_INVALID_RESPONSE" });
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

function explorePage(apps: Array<{ androidPackage: string; versionCode: number | null }>, hasNextPage = apps.length > 0) {
  return {
    data: {
      explore: {
        units: {
          edges: [{
            node: {
              __typename: "DAppsByCategoryUnit",
              dApps: {
                pageInfo: { hasNextPage },
                edges: apps.map((app) => ({
                  node: {
                    androidPackage: app.androidPackage,
                    lastRelease: app.versionCode === null ? null : { androidDetails: { versionCode: app.versionCode } }
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
