import { describe, expect, it, vi } from "vitest";
import {
  OfficialSolanaMobileApprovalProvider,
  SEEKER_STORE_CONTEXT,
  SOLANA_MOBILE_GRAPHQL_ENDPOINT,
  type FetchLike
} from "../server/solana-mobile-approval-provider";

const checkedAt = new Date("2026-08-24T12:00:00.000Z");

describe("Solana Mobile official approval provider", () => {
  it("returns the latest officially visible package version and requests only the required fields", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({
      data: {
        dAppByAndroidPackage: {
          androidPackage: "com.example.game",
          lastRelease: { androidDetails: { versionCode: 2 } }
        }
      }
    }));
    const provider = new OfficialSolanaMobileApprovalProvider(fetchImpl, () => checkedAt);

    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toEqual({
      status: "visible",
      androidPackage: "com.example.game",
      versionCode: 2n,
      checkedAt: checkedAt.toISOString(),
      systemContext: SEEKER_STORE_CONTEXT,
      sourceReference: SOLANA_MOBILE_GRAPHQL_ENDPOINT
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
    const body = JSON.parse(init.body) as { query: string };
    expect(body.query).toContain("androidPackage");
    expect(body.query).toContain("androidDetails { versionCode }");
    expect(body.query).not.toMatch(/description|icon|screenshots|publisherDetails/);
  });

  it("treats a successful empty result as not visible", async () => {
    const provider = providerReturning({ data: { dAppByAndroidPackage: null } });
    await expect(provider.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "not_visible",
      androidPackage: "com.example.game"
    });
  });

  it("preserves prior state by reporting GraphQL and transport failures as unavailable", async () => {
    const graphql = providerReturning({ data: null, errors: [{ message: "error" }] });
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

  it("rejects malformed and mismatched provider data", async () => {
    const invalidVersion = providerReturning({
      data: { dAppByAndroidPackage: { androidPackage: "com.example.game", lastRelease: { androidDetails: { versionCode: -1 } } } }
    });
    await expect(invalidVersion.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_INVALID_RESPONSE"
    });

    const mismatch = providerReturning({
      data: { dAppByAndroidPackage: { androidPackage: "com.attacker.app", lastRelease: { androidDetails: { versionCode: 2 } } } }
    });
    await expect(mismatch.lookupLatestVisibleRelease("com.example.game")).resolves.toMatchObject({
      status: "unavailable",
      errorCode: "OFFICIAL_PROVIDER_PACKAGE_MISMATCH"
    });
  });
});

function providerReturning(value: unknown): OfficialSolanaMobileApprovalProvider {
  return new OfficialSolanaMobileApprovalProvider(
    vi.fn<FetchLike>().mockResolvedValue(jsonResponse(value)),
    () => checkedAt
  );
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
