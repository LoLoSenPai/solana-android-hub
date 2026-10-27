import type { CatalogAppRecord } from "@hub/database";
import { publicPublisherProfileDtoSchema } from "@hub/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/v1/publishers/[slug]/route";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), candidates: vi.fn() }));
vi.mock("../server/runtime", () => ({
  database: {}, hubConfig: { appEnvironment: "production", allowedPreviewAppMints: new Set() }
}));
vi.mock("@hub/database", () => ({
  PublisherProfileRepository: class { getPublicBySlug = mocks.profile; },
  CatalogRepository: class { listReleaseCandidates = mocks.candidates; }
}));

const profile = {
  id: "30000000-0000-4000-8000-000000000001", slug: "test-dev", displayName: "Test Dev",
  bio: "Developer", avatarUrl: null, portfolioUrl: "https://example.com",
  links: { website: null, x: null, discord: null, telegram: null }
};
const id = "4ee7bd84-ef4f-4ab0-9338-9c1cebcdf3d6";

function request(channel = "") {
  return GET(new Request(`https://hub.example/api/v1/publishers/test-dev${channel}`, {
    headers: { "x-request-id": id }
  }), { params: Promise.resolve({ slug: "Test-Dev" }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockResolvedValue(profile);
  mocks.candidates.mockResolvedValue([]);
});

describe("public publisher API", () => {
  it("rejects invalid channels before reading the database", async () => {
    const response = await request("?channel=private");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_QUERY", message: "The publisher profile query is invalid." }, requestId: id });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.candidates).not.toHaveBeenCalled();
  });

  it("returns a normalized 404 for unknown or unavailable publishers", async () => {
    mocks.profile.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "PUBLISHER_NOT_FOUND", message: "The publisher profile was not found." }, requestId: id });
    expect(mocks.candidates).not.toHaveBeenCalled();
  });

  it("exposes only public profile fields and the eligible apps of that publisher", async () => {
    mocks.profile.mockResolvedValue({ ...profile, email: "private@example.com", walletAddress: "secret", session: "secret" });
    const valid = record(1);
    const revoked = record(2); revoked.eligibility.consentStatus = "revoked";
    const suspended = record(3); suspended.eligibility.claimStatus = "suspended";
    const unpublished = record(4); unpublished.release.publicationStatus = "unpublished";
    const disabled = record(5); disabled.eligibility.distributionEnabled = false;
    mocks.candidates.mockResolvedValue([valid, revoked, suspended, unpublished, disabled]);
    const response = await request();
    expect(response.status).toBe(200);
    const result = publicPublisherProfileDtoSchema.parse(await response.json());
    expect(result.profile).toEqual(profile);
    expect(result.apps.map((app: { slug: string }) => app.slug)).toEqual(["app-1"]);
    expect(mocks.profile).toHaveBeenCalledWith("test-dev");
    expect(mocks.candidates).toHaveBeenCalledWith("production", undefined, undefined, profile.id);
  });

  it("applies the approved channel to the publisher's apps", async () => {
    const approved = record(1); approved.release.approvalStatus = "verified_approved";
    mocks.candidates.mockResolvedValue([approved, record(2)]);
    const response = await request("?channel=approved");
    const result = publicPublisherProfileDtoSchema.parse(await response.json());
    expect(result.apps.map((app: { slug: string }) => app.slug)).toEqual(["app-1"]);
  });

  it("normalizes database failures without exposing internal errors", async () => {
    mocks.profile.mockRejectedValue(new Error("database password secret"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "PUBLISHER_PROFILE_UNAVAILABLE", message: "The publisher profile is temporarily unavailable." }, requestId: id });
  });

  it("shows official v11 presence while serving published v10 without approving it", async () => {
    const published = record(1);
    published.release.versionCode = 10n;
    published.solanaMobileStore = {
      status: "visible", versionCode: "11", checkedAt: "2026-10-27T12:00:00.000Z",
      sourceReference: "https://dappstore.solanamobile.com/graphql#explore"
    };
    const unpublished = structuredClone(published);
    unpublished.release = { ...published.release, id: "20000000-0000-4000-8000-000000000011", versionCode: 11n, publicationStatus: "unpublished", approvalStatus: "verified_approved" };
    mocks.candidates.mockResolvedValue([unpublished, published]);
    const result = publicPublisherProfileDtoSchema.parse(await (await request()).json());
    expect(result.apps[0]?.solanaMobileStore?.status).toBe("visible");
    expect(result.apps[0]?.latestRelease.versionCode).toBe("10");
    expect(result.apps[0]?.latestRelease.trust.solanaMobileApproval).toBe("unknown");
    const approved = publicPublisherProfileDtoSchema.parse(await (await request("?channel=approved")).json());
    expect(approved.apps).toEqual([]);
  });
});

function record(index: number): CatalogAppRecord {
  return {
    id: `10000000-0000-4000-8000-00000000000${index}`, publisher: { id: profile.id, slug: profile.slug, displayName: profile.displayName },
    appMint: `app-${index}-mint`, slug: `app-${index}`, packageName: `com.example.app${index}`, name: `App ${index}`,
    shortDescription: null, description: null, iconUri: null, screenshots: [], bannerUri: null, featureGraphicUri: null,
    category: "other", genres: [], publisherLinks: profile.links, solanaMobileRating: null, solanaMobileStore: null,
    eligibility: { appMint: `app-${index}-mint`, claimStatus: "verified", authorityCurrent: true, consentStatus: "active", consentEnvironment: "production", distributionEnabled: true },
    release: {
      id: `20000000-0000-4000-8000-00000000000${index}`, releaseMint: `release-${index}`, appMint: `app-${index}-mint`,
      packageName: `com.example.app${index}`, versionName: "1.0.0", versionCode: 1n, certificateSha256: "a".repeat(64),
      permissions: [], validationStatus: "server_binary_valid", publicationStatus: "published", approvalStatus: "unknown"
    },
    binary: { apkUri: "https://example.com/app.apk", apkSize: 1024, apkSha256: "b".repeat(64), minSdk: 26, targetSdk: 36 },
    releaseUpdatedAt: new Date("2026-10-12T00:00:00.000Z")
  };
}
