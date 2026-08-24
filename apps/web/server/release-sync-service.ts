import { createHash, randomUUID } from "node:crypto";
import { PublisherRepository, ReleaseRepository, type SavedRelease, type ScheduledSyncTarget, type SessionRecord } from "@hub/database";
import {
  createHeliusFinalizedAccountReader,
  createHeliusReleaseDiscovery,
  fetchHardenedJson,
  FinalizedMetadataVerifier
} from "@hub/solana";
import { normalizeReleaseMetadata, type NormalizedReleaseMetadata } from "@hub/validation";
import { shouldRequestAutomaticValidation } from "./automatic-validation";
import { database, hubConfig } from "./runtime";
import { OfficialSolanaMobileApprovalProvider } from "./solana-mobile-approval-provider";
import { requestBinaryValidation } from "./validation-service";

const publisherRepository = new PublisherRepository(database);
const releaseRepository = new ReleaseRepository(database);
const approvalProvider = new OfficialSolanaMobileApprovalProvider();

interface VerifiedReleaseCandidate {
  mint: string;
  metadataUri: string;
  normalized: NormalizedReleaseMetadata;
  evidence: Awaited<ReturnType<FinalizedMetadataVerifier["verifyRelease"]>>;
  sourceSnapshotJson: string;
  sourceSnapshotHash: string;
}

export async function syncPublisherApp(
  session: Pick<SessionRecord, "publisherId" | "publisherWalletId" | "walletAddress">,
  appId: string,
  kind: "claim" | "manual" | "scheduled" | "stale_refresh" = "manual"
) {
  const app = await publisherRepository.getAppForPublisher(appId, session.publisherId);
  if (!app || app.claimStatus !== "verified") throw new Error("PUBLISHER_APP_NOT_FOUND");
  if (!hubConfig.heliusApiKey) throw new Error("HELIUS_NOT_CONFIGURED");

  const job = await releaseRepository.acquireSyncJob({ appId: app.id, kind, leaseOwner: randomUUID() });
  if (!job) return { status: "already_running" as const, releases: [] as readonly SavedRelease[] };

  try {
    const verifier = new FinalizedMetadataVerifier(createHeliusFinalizedAccountReader(hubConfig.heliusApiKey));
    const authority = await verifier.verifyAppAuthority({
      wallet: session.walletAddress,
      appMint: app.appMint
    });
    const discovery = createHeliusReleaseDiscovery(hubConfig.heliusApiKey);
    const discovered = await discovery.discoverReleases(app.appMint);
    const verified: VerifiedReleaseCandidate[] = [];
    const failures: Array<{ mint: string; code: string }> = [];

    for (const candidate of discovered) {
      try {
        if (candidate.burnt) throw new Error("RELEASE_BURNED");
        if (candidate.compression !== "uncompressed") throw new Error("COMPRESSED_RELEASE_UNSUPPORTED");
        const evidence = await verifier.verifyRelease(candidate.mint, app.appMint);
        const metadataJson = await fetchHardenedJson(evidence.evidence.metadataUri);
        const normalized = normalizeReleaseMetadata(metadataJson);
        const sourceSnapshot = {
          schemaRevision: normalized.schemaVersion,
          releaseMetadata: metadataJson,
          finalizedEvidence: {
            ...evidence,
            finalizedSlot: evidence.finalizedSlot.toString()
          }
        };
        const sourceSnapshotJson = canonicalJson(sourceSnapshot);
        verified.push({
          mint: candidate.mint,
          metadataUri: evidence.evidence.metadataUri,
          normalized,
          evidence,
          sourceSnapshotJson,
          sourceSnapshotHash: createHash("sha256").update(sourceSnapshotJson).digest("hex")
        });
      } catch (error) {
        failures.push({ mint: candidate.mint, code: errorCode(error) });
      }
    }

    const initialBackfill = await releaseRepository.countReleases(app.id) === 0;
    const releases: SavedRelease[] = [];
    for (const candidate of verified.toSorted((left, right) => left.normalized.versionCode < right.normalized.versionCode ? -1 : 1)) {
      releases.push(await releaseRepository.saveMetadataValidRelease({
        app,
        releaseMint: candidate.mint,
        metadataUri: candidate.metadataUri,
        sourceSnapshotJson: candidate.sourceSnapshotJson,
        sourceSnapshotHash: candidate.sourceSnapshotHash,
        normalized: candidate.normalized,
        evidence: candidate.evidence.evidence,
        finalizedSlot: candidate.evidence.finalizedSlot,
        environment: hubConfig.appEnvironment,
        previewAllowed: hubConfig.allowedPreviewAppMints.has(app.appMint),
        initialBackfill
      }));
    }
    const officialApproval = app.distributionEnabled
      ? await reconcileOfficialApproval(app.id, app.packageName)
      : { status: "skipped_no_consent" as const };
    const maxReleaseSlot = verified.reduce((slot, item) => item.evidence.finalizedSlot > slot ? item.evidence.finalizedSlot : slot, authority.finalizedSlot);
    await releaseRepository.completeSyncJob(job, {
      discovered: discovered.length,
      normalized: verified.length,
      releases,
      failures,
      officialApproval
    }, maxReleaseSlot);
    const validationFailures: Array<{ releaseId: string; code: string }> = [];
    for (const release of releases.filter((item) => shouldRequestAutomaticValidation(app.releasePolicy, item))) {
      try {
        await requestBinaryValidation(session, release.id);
      } catch (error) {
        validationFailures.push({ releaseId: release.id, code: errorCode(error) });
      }
    }
    return { status: "completed" as const, releases, failures, validationFailures };
  } catch (error) {
    const code = errorCode(error);
    if (authorityLossCodes.has(code)) await releaseRepository.suspendForAuthorityLoss(app.id, code);
    await releaseRepository.failSyncJob(job, code, error instanceof Error ? error.message : "Unknown sync failure");
    throw error;
  }
}

async function reconcileOfficialApproval(appId: string, packageName: string): Promise<{
  status: "verified" | "not_visible" | "release_not_found" | "unavailable";
  errorCode?: string;
}> {
  const lookup = await approvalProvider.lookupLatestVisibleRelease(packageName);
  if (lookup.status === "unavailable") return { status: "unavailable", errorCode: lookup.errorCode };

  try {
    const status = await releaseRepository.reconcileOfficialStoreApproval({
      appId,
      packageName,
      versionCode: lookup.status === "visible" ? lookup.versionCode : null,
      sourceReference: lookup.sourceReference,
      evidence: {
        provider: "solana_mobile_dapp_store_graphql",
        query: "explore.units.DAppsByCategoryUnit.dApps.lastRelease.androidDetails.versionCode",
        androidPackage: lookup.androidPackage,
        versionCode: lookup.status === "visible" ? lookup.versionCode.toString() : null,
        checkedAt: lookup.checkedAt,
        systemContext: lookup.systemContext
      }
    });
    return { status };
  } catch (error) {
    return { status: "unavailable", errorCode: errorCode(error) };
  }
}

const authorityLossCodes = new Set([
  "WALLET_NOT_APP_AUTHORITY",
  "APP_PUBLISHER_COLLECTION_NOT_VERIFIED",
  "APP_MUST_BE_COLLECTION_NFT",
  "INVALID_PUBLISHER_COLLECTION_TOKEN_STANDARD",
  "TOKEN_METADATA_MINT_MISMATCH"
]);

export async function syncDuePublisherApps(limit = 20) {
  const targets = await releaseRepository.listDueSyncTargets(hubConfig.appEnvironment, limit);
  const results: Array<{ appId: string; status: "completed" | "failed" | "already_running" }> = [];
  for (const target of targets) {
    try {
      const result = await syncPublisherApp(syncContext(target), target.appId, "scheduled");
      results.push({ appId: target.appId, status: result.status });
    } catch {
      results.push({ appId: target.appId, status: "failed" });
    }
  }
  return results;
}

function syncContext(target: ScheduledSyncTarget): Pick<SessionRecord, "publisherId" | "publisherWalletId" | "walletAddress"> {
  return {
    publisherId: target.publisherId,
    publisherWalletId: target.publisherWalletId,
    walletAddress: target.walletAddress
  };
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN_SYNC_FAILURE";
  return /^[A-Z0-9_]+$/.test(error.message) ? error.message : "RELEASE_SYNC_FAILED";
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
  }
  return value;
}
