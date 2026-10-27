import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncDuePublisherApps, syncPublisherApp } from "../server/release-sync-service";

const mocks = vi.hoisted(() => ({
  app: vi.fn(), acquire: vi.fn(), count: vi.fn(), save: vi.fn(), complete: vi.fn(), fail: vi.fn(), suspend: vi.fn(),
  reconcile: vi.fn(), cache: vi.fn(), targets: vi.fn(), authority: vi.fn(), verify: vi.fn(), discover: vi.fn(),
  fetch: vi.fn(), normalize: vi.fn(), approval: vi.fn(), rating: vi.fn(), validate: vi.fn(), expire: vi.fn()
}));
vi.mock("../server/runtime", () => ({ database: {}, hubConfig: {
  heliusApiKey: "test", appEnvironment: "production", allowedPreviewAppMints: new Set()
} }));
vi.mock("@hub/database", () => ({
  PublisherRepository: class { getAppForPublisher = mocks.app; },
  ReleaseRepository: class {
    acquireSyncJob = mocks.acquire; countReleases = mocks.count; saveMetadataValidRelease = mocks.save;
    completeSyncJob = mocks.complete; failSyncJob = mocks.fail; suspendForAuthorityLoss = mocks.suspend;
    reconcileOfficialStoreApproval = mocks.reconcile; findLatestOfficialStoreRating = mocks.cache; listDueSyncTargets = mocks.targets;
  }
}));
vi.mock("@hub/solana", () => ({
  createHeliusFinalizedAccountReader: vi.fn(),
  createHeliusReleaseDiscovery: () => ({ discoverReleases: mocks.discover }),
  FinalizedMetadataVerifier: class { verifyAppAuthority = mocks.authority; verifyRelease = mocks.verify; },
  fetchHardenedJson: mocks.fetch
}));
vi.mock("@hub/validation", () => ({ normalizeReleaseMetadata: mocks.normalize }));
vi.mock("../server/solana-mobile-approval-provider", () => ({
  OfficialSolanaMobileApprovalProvider: class { lookupLatestVisibleRelease = mocks.approval; lookupRating = mocks.rating; }
}));
vi.mock("../server/validation-service", () => ({ requestBinaryValidation: mocks.validate, expireStaleBinaryValidations: mocks.expire }));

const session = { publisherId: "publisher", publisherWalletId: "wallet-id", walletAddress: "wallet" };
const job = { id: "job", appId: "app", leaseOwner: "lease" };
const visible = {
  status: "visible", androidPackage: "com.example.game", versionCode: 11n,
  checkedAt: "2026-10-27T12:00:00.000Z", sourceReference: "https://dappstore.solanamobile.com/graphql#explore", systemContext: {}
};
const rating = {
  averageRating: 4, reviewsByRating: [0, 0, 0, 2, 0],
  checkedAt: new Date().toISOString(), sourceReference: "https://dappstore.solanamobile.com/graphql#dAppByAndroidPackage.rating"
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.app.mockResolvedValue({ id: "app", appMint: "mint", packageName: "com.example.game", claimStatus: "verified", distributionEnabled: true, releasePolicy: "automatic" });
  mocks.acquire.mockResolvedValue(job);
  mocks.authority.mockResolvedValue({ finalizedSlot: 100n });
  mocks.discover.mockResolvedValue([]);
  mocks.count.mockResolvedValue(1);
  mocks.approval.mockResolvedValue(visible);
  mocks.reconcile.mockResolvedValue("verified");
  mocks.cache.mockResolvedValue(null);
  mocks.rating.mockResolvedValue({ status: "available", ...rating });
  mocks.targets.mockResolvedValue([]);
});

describe("release synchronization outcomes", () => {
  it("marks provider unavailability partial and persists the useful result with issues", async () => {
    mocks.approval.mockResolvedValue({ status: "unavailable", errorCode: "PROVIDER_TIMEOUT", androidPackage: visible.androidPackage, checkedAt: visible.checkedAt });
    const result = await syncPublisherApp(session, "app");
    expect(result.status).toBe("partial");
    expect(result).toMatchObject({ issues: ["OFFICIAL_APPROVAL:PROVIDER_TIMEOUT"], officialRating: { status: "available", averageRating: 4 } });
    expect(mocks.complete).toHaveBeenCalledWith(job, expect.objectContaining({
      officialApproval: { status: "unavailable", errorCode: "PROVIDER_TIMEOUT", androidPackage: visible.androidPackage, checkedAt: visible.checkedAt },
      officialRating: expect.objectContaining({ status: "available", averageRating: 4 }) as unknown, issues: ["OFFICIAL_APPROVAL:PROVIDER_TIMEOUT"]
    }), 100n, ["OFFICIAL_APPROVAL:PROVIDER_TIMEOUT"]);
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("completes an absent HeroStars package without requesting ratings", async () => {
    mocks.app.mockResolvedValue({ id: "app", appMint: "mint", packageName: "com.herostars", claimStatus: "verified", distributionEnabled: true, releasePolicy: "automatic" });
    mocks.approval.mockResolvedValue({ ...visible, status: "not_visible", androidPackage: "com.herostars", versionCode: undefined });
    mocks.reconcile.mockResolvedValue("not_visible");
    const result = await syncPublisherApp(session, "app");
    expect(result).toMatchObject({ status: "completed", issues: [], officialApproval: { status: "not_visible", versionCode: null, checkedAt: visible.checkedAt, sourceReference: visible.sourceReference }, officialRating: { status: "skipped_not_visible" } });
    expect(mocks.cache).not.toHaveBeenCalled();
    expect(mocks.rating).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(job, expect.objectContaining({ issues: [] }), 100n, []);
  });

  it("retains stale cached ratings but signals the failed refresh and partial outcome", async () => {
    const cached = { ...rating, checkedAt: "2020-01-01T00:00:00.000Z" };
    mocks.cache.mockResolvedValue(cached);
    mocks.rating.mockResolvedValue({ status: "unavailable", errorCode: "RATING_TIMEOUT" });
    const result = await syncPublisherApp(session, "app");
    expect(result).toMatchObject({ status: "partial", officialRating: { status: "available", ...cached, refreshErrorCode: "RATING_TIMEOUT" }, issues: ["OFFICIAL_RATING:RATING_TIMEOUT"] });
    expect(mocks.complete).toHaveBeenCalledWith(job, expect.objectContaining({ officialRating: expect.objectContaining({ refreshErrorCode: "RATING_TIMEOUT" }) as unknown }), 100n, ["OFFICIAL_RATING:RATING_TIMEOUT"]);
  });

  it("persists validation dispatch failures before completing the sync job", async () => {
    mocks.discover.mockResolvedValue([{ mint: "release-mint", compression: "uncompressed", burnt: false }]);
    mocks.verify.mockResolvedValue({ finalizedSlot: 120n, evidence: { metadataUri: "https://example.com/meta.json" } });
    mocks.fetch.mockResolvedValue({ name: "Release" });
    mocks.normalize.mockReturnValue({ schemaVersion: "1", versionCode: 11n });
    mocks.save.mockResolvedValue({ id: "release-id", releaseMint: "release-mint", validationStatus: "metadata_valid", publicationStatus: "unpublished", quarantineCode: null });
    mocks.validate.mockRejectedValue(new Error("VALIDATION_QUEUE_UNAVAILABLE"));
    const result = await syncPublisherApp(session, "app");
    expect(result).toMatchObject({ status: "partial", validationFailures: [{ releaseId: "release-id", code: "VALIDATION_QUEUE_UNAVAILABLE" }] });
    expect(mocks.complete).toHaveBeenCalledWith(job, expect.objectContaining({ validationFailures: [{ releaseId: "release-id", code: "VALIDATION_QUEUE_UNAVAILABLE" }] }), 120n, ["VALIDATION_DISPATCH:VALIDATION_QUEUE_UNAVAILABLE"]);
    expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(mocks.complete.mock.invocationCallOrder[0]!);
  });

  it("enriches conclusive app evidence and completes a healthy synchronization", async () => {
    const result = await syncPublisherApp(session, "app");
    expect(result).toMatchObject({ status: "completed", issues: [], officialApproval: {
      status: "verified", androidPackage: visible.androidPackage, versionCode: "11", checkedAt: visible.checkedAt, sourceReference: visible.sourceReference
    } });
  });

  it("passes forced scheduling through to the due-target selection", async () => {
    await expect(syncDuePublisherApps(20, true)).resolves.toEqual([]);
    expect(mocks.targets).toHaveBeenCalledWith("production", 20, true);
    expect(mocks.expire).toHaveBeenCalledOnce();
  });

  it("preserves partial and failed statuses when processing a scheduled batch", async () => {
    mocks.targets.mockResolvedValue([
      { appId: "app", ...session }, { appId: "missing-app", ...session }
    ]);
    mocks.app.mockResolvedValueOnce({ id: "app", appMint: "mint", packageName: visible.androidPackage, claimStatus: "verified", distributionEnabled: true, releasePolicy: "automatic" })
      .mockResolvedValueOnce(null);
    mocks.approval.mockResolvedValue({ status: "unavailable", errorCode: "PROVIDER_TIMEOUT" });
    await expect(syncDuePublisherApps(20, true)).resolves.toEqual([
      { appId: "app", status: "partial", issues: ["OFFICIAL_APPROVAL:PROVIDER_TIMEOUT"] },
      { appId: "missing-app", status: "failed", issues: ["PUBLISHER_APP_NOT_FOUND"] }
    ]);
  });
});
