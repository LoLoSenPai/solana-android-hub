import type { AppEnvironment } from "@hub/domain";
import type { MetadataEvidence } from "@hub/solana";
import type { NormalizedReleaseMetadata } from "@hub/validation";
import type { JSONValue } from "postgres";
import type { HubSql } from "./client";
import type { PublisherAppRecord } from "./publisher-repository";
import { parseJsonValue } from "./json";

export interface ScheduledSyncTarget {
  appId: string;
  publisherId: string;
  publisherWalletId: string;
  walletAddress: string;
}

export interface AcquiredSyncJob {
  id: string;
  appId: string;
  leaseOwner: string;
}

export interface SavedRelease {
  id: string;
  releaseMint: string;
  validationStatus: "metadata_valid" | "validating_binary" | "server_binary_valid" | "quarantined";
  publicationStatus: "preview" | "unpublished" | "published" | "ignored" | "withdrawn";
  quarantineCode: string | null;
}

export type OfficialApprovalReconciliation = "verified" | "not_visible" | "release_not_found";

export class ReleaseRepository {
  public constructor(private readonly sql: HubSql) {}

  public async acquireSyncJob(input: {
    appId: string;
    kind: "claim" | "manual" | "scheduled" | "stale_refresh";
    leaseOwner: string;
  }): Promise<AcquiredSyncJob | null> {
    return this.sql.begin(async (tx) => {
      const [job] = await tx<{ id: string }[]>`
        insert into hub.sync_jobs (app_id, kind)
        values (${input.appId}, ${input.kind})
        on conflict (app_id) where status in ('queued', 'running') do nothing
        returning id
      `;
      if (!job) return null;
      await tx`
        update hub.sync_jobs
        set status = 'running', lease_owner = ${input.leaseOwner}, lease_expires_at = now() + interval '2 minutes',
            started_at = now(), attempt = attempt + 1
        where id = ${job.id}
      `;
      return { id: job.id, appId: input.appId, leaseOwner: input.leaseOwner };
    });
  }

  public async completeSyncJob(job: AcquiredSyncJob, result: unknown, finalizedSlot: bigint): Promise<void> {
    const serializedResult: JSONValue = parseJsonValue(JSON.stringify(result));
    await this.sql.begin(async (tx) => {
      await tx`
        update hub.sync_jobs set status = 'succeeded', result = ${tx.json(serializedResult)}, completed_at = now(), lease_expires_at = null
        where id = ${job.id} and lease_owner = ${job.leaseOwner} and status = 'running'
      `;
      await tx`
        insert into hub.sync_state (app_id, last_finalized_slot, last_success_at, next_sync_at, consecutive_failures)
        values (${job.appId}, ${finalizedSlot.toString()}, now(), now() + interval '15 minutes', 0)
        on conflict (app_id) do update set
          last_finalized_slot = excluded.last_finalized_slot,
          last_success_at = now(), next_sync_at = excluded.next_sync_at, consecutive_failures = 0, updated_at = now()
      `;
    });
  }

  public async failSyncJob(job: AcquiredSyncJob, errorCode: string, errorDetail: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`
        update hub.sync_jobs set status = 'failed', error_code = ${errorCode}, error_detail = ${errorDetail.slice(0, 1000)},
          completed_at = now(), lease_expires_at = null
        where id = ${job.id} and lease_owner = ${job.leaseOwner} and status = 'running'
      `;
      await tx`
        insert into hub.sync_state (app_id, next_sync_at, consecutive_failures)
        values (${job.appId}, now() + interval '5 minutes', 1)
        on conflict (app_id) do update set
          consecutive_failures = hub.sync_state.consecutive_failures + 1,
          next_sync_at = now() + least(interval '1 hour', interval '1 minute' * power(2, least(hub.sync_state.consecutive_failures, 6))),
          updated_at = now()
      `;
    });
  }

  public async suspendForAuthorityLoss(appId: string, reason: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`
        update hub.apps set claim_status = 'suspended', distribution_enabled = false, suspended_at = now(),
          suspension_reason = ${reason}, updated_at = now()
        where id = ${appId} and claim_status = 'verified'
      `;
      await tx`
        update hub.app_claims set status = 'suspended' where app_id = ${appId} and status = 'verified' and superseded_at is null
      `;
      await tx`
        update hub.releases set publication_status = 'withdrawn', updated_at = now()
        where app_id = ${appId} and publication_status in ('preview', 'published')
      `;
    });
  }

  public async countReleases(appId: string): Promise<number> {
    const [row] = await this.sql<{ count: string }[]>`select count(*)::text as count from hub.releases where app_id = ${appId}`;
    return Number(row?.count ?? 0);
  }

  public async reconcileOfficialStoreApproval(input: {
    appId: string;
    packageName: string;
    versionCode: bigint | null;
    sourceReference: string;
    evidence: unknown;
  }): Promise<OfficialApprovalReconciliation> {
    const serializedEvidence: JSONValue = parseJsonValue(JSON.stringify(input.evidence));
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${input.appId}))`;
      const [app] = await tx<{ package_name: string }[]>`
        select package_name from hub.apps where id = ${input.appId} for update
      `;
      if (!app) throw new Error("APP_NOT_FOUND");
      if (app.package_name !== input.packageName) throw new Error("OFFICIAL_APPROVAL_PACKAGE_MISMATCH");

      const currentOfficial = await tx<{ release_id: string }[]>`
        select approval.release_id
        from hub.release_approvals approval
        join hub.releases release on release.id = approval.release_id
        where release.app_id = ${input.appId}
          and approval.source = 'official_provider'
          and approval.status = 'verified_approved'
          and approval.superseded_at is null
        for update of approval
      `;

      const candidates = input.versionCode === null ? [] : await tx<{ id: string }[]>`
        select id from hub.releases
        where app_id = ${input.appId}
          and package_name = ${input.packageName}
          and version_code = ${input.versionCode.toString()}
          and validation_status <> 'quarantined'
        order by discovered_at desc
        limit 2
        for update
      `;
      const target = candidates.length === 1 ? candidates[0] : undefined;
      const targetAlreadyCurrent = target !== undefined
        && currentOfficial.length === 1
        && currentOfficial[0]?.release_id === target.id;

      if (targetAlreadyCurrent) {
        await tx`
          update hub.release_approvals
          set source_reference = ${input.sourceReference}, evidence = ${tx.json(serializedEvidence)}, verified_at = now()
          where release_id = ${target.id} and source = 'official_provider' and superseded_at is null
        `;
        return "verified";
      }

      await tx`
        update hub.release_approvals approval
        set superseded_at = now()
        from hub.releases release
        where release.id = approval.release_id
          and release.app_id = ${input.appId}
          and approval.source = 'official_provider'
          and approval.superseded_at is null
      `;

      if (target) {
        await tx`
          update hub.release_approvals
          set superseded_at = now()
          where release_id = ${target.id} and superseded_at is null
        `;
        await tx`
          insert into hub.release_approvals (release_id, status, source, source_reference, evidence, verified_at)
          values (${target.id}, 'verified_approved', 'official_provider', ${input.sourceReference}, ${tx.json(serializedEvidence)}, now())
        `;
      }

      if (currentOfficial.length > 0 || target) {
        await tx`update hub.releases set updated_at = now() where app_id = ${input.appId}`;
      }
      if (input.versionCode === null) return "not_visible";
      return target ? "verified" : "release_not_found";
    });
  }

  public async listDueSyncTargets(environment: AppEnvironment, limit = 20): Promise<readonly ScheduledSyncTarget[]> {
    const rows = await this.sql<{
      app_id: string; publisher_id: string; publisher_wallet_id: string; wallet_address: string;
    }[]>`
      select a.id as app_id, a.publisher_id, claim.publisher_wallet_id, wallet.wallet_address
      from hub.apps a
      join lateral (
        select publisher_wallet_id from hub.app_claims where app_id = a.id and status = 'verified' and superseded_at is null
        order by verified_at desc limit 1
      ) claim on true
      join hub.publisher_wallets wallet on wallet.id = claim.publisher_wallet_id
      left join hub.sync_state state on state.app_id = a.id
      where a.claim_status = 'verified' and a.distribution_enabled = true and a.suspended_at is null and a.revoked_at is null
        and exists (
          select 1 from hub.distribution_consents consent where consent.app_id = a.id
            and consent.environment = ${environment}::hub.app_environment and consent.status = 'active' and consent.superseded_at is null
        )
        and coalesce(state.next_sync_at, now()) <= now()
      order by coalesce(state.next_sync_at, a.updated_at) asc
      limit ${limit}
    `;
    return rows.map((row) => ({
      appId: row.app_id,
      publisherId: row.publisher_id,
      publisherWalletId: row.publisher_wallet_id,
      walletAddress: row.wallet_address
    }));
  }

  public async saveMetadataValidRelease(input: {
    app: PublisherAppRecord;
    releaseMint: string;
    metadataUri: string;
    sourceSnapshotJson: string;
    sourceSnapshotHash: string;
    normalized: NormalizedReleaseMetadata;
    evidence: MetadataEvidence;
    finalizedSlot: bigint;
    environment: AppEnvironment;
    previewAllowed: boolean;
    initialBackfill: boolean;
  }): Promise<SavedRelease> {
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${input.releaseMint}))`;
      const [existing] = await tx<{
        id: string;
        package_name: string;
        version_code: string;
        apk_sha256: string;
        certificate_sha256: string;
        validation_status: SavedRelease["validationStatus"] | "server_binary_valid" | "discovered" | "validating_binary";
        publication_status: SavedRelease["publicationStatus"] | "published" | "ignored" | "withdrawn";
        quarantine_code: string | null;
      }[]>`
        select id, package_name, version_code::text, apk_sha256, certificate_sha256, validation_status, publication_status, quarantine_code
        from hub.releases where release_mint = ${input.releaseMint} for update
      `;

      let quarantineCode: string | null = null;
      if (input.normalized.packageName !== input.app.packageName) quarantineCode = "package_changed";
      if (existing && (existing.package_name !== input.normalized.packageName || existing.version_code !== input.normalized.versionCode.toString() ||
        existing.apk_sha256 !== input.normalized.apkSha256 || existing.certificate_sha256 !== input.normalized.certificateSha256)) {
        quarantineCode = "immutable_metadata_changed";
      }

      const [highest] = await tx<{ version_code: string; certificate_sha256: string }[]>`
        select version_code::text, certificate_sha256 from hub.releases
        where app_id = ${input.app.id} and release_mint <> ${input.releaseMint} and validation_status <> 'quarantined'
        order by version_code desc limit 1
      `;
      if (!quarantineCode && highest && highest.certificate_sha256 !== input.normalized.certificateSha256) quarantineCode = "certificate_changed";
      if (!quarantineCode && !existing && !input.initialBackfill && highest
        && input.normalized.versionCode <= BigInt(highest.version_code)) quarantineCode = "version_regression";

      const [duplicate] = await tx<{ id: string }[]>`
        select id from hub.releases
        where app_id = ${input.app.id} and release_mint <> ${input.releaseMint}
          and apk_sha256 = ${input.normalized.apkSha256} and version_code = ${input.normalized.versionCode.toString()}
        limit 1
      `;
      if (!quarantineCode && duplicate) quarantineCode = "duplicate_binary_identity";

      const [successfulBinaryRun] = existing && !quarantineCode
        ? await tx<{ present: boolean }[]>`
            select true as present from hub.release_validation_runs
            where release_id = ${existing.id} and stage = 'binary' and status = 'succeeded'
            order by completed_at desc limit 1
          `
        : [];
      const validationStatus = quarantineCode
        ? "quarantined"
        : successfulBinaryRun
          ? "server_binary_valid"
          : "metadata_valid";
      const publicationStatus = !quarantineCode && input.environment !== "production" && input.previewAllowed ? "preview" : "unpublished";
      const [release] = await tx<{
        id: string;
        validation_status: SavedRelease["validationStatus"];
        publication_status: SavedRelease["publicationStatus"];
        quarantine_code: string | null;
      }[]>`
        insert into hub.releases (
          app_id, release_mint, metadata_uri, source_snapshot, source_snapshot_hash, package_name, version_name,
          version_code, apk_uri, apk_size, apk_sha256, certificate_sha256, min_sdk, target_sdk, permissions, locales,
          icon_uri, screenshots, banner_uri, feature_graphic_uri,
          collection_verified, metadata_immutable, validation_status, publication_status, quarantine_code, quarantine_detail,
          discovered_slot, validated_at
        ) values (
          ${input.app.id}, ${input.releaseMint}, ${input.metadataUri}, ${tx.json(parseJsonValue(input.sourceSnapshotJson))}, ${input.sourceSnapshotHash},
          ${input.normalized.packageName}, ${input.normalized.versionName}, ${input.normalized.versionCode.toString()},
          ${input.normalized.apkUri}, ${input.normalized.apkSize}, ${input.normalized.apkSha256}, ${input.normalized.certificateSha256},
          ${input.normalized.minSdk}, ${input.normalized.targetSdk ?? null}, ${input.normalized.permissions}, ${input.normalized.locales},
          ${input.normalized.iconUri}, ${tx.json([...input.normalized.screenshots])},
          ${input.normalized.bannerUri ?? null}, ${input.normalized.featureGraphicUri ?? null},
          true, true, ${validationStatus}::hub.release_validation_status, ${publicationStatus}::hub.publication_status,
          ${quarantineCode}, ${quarantineCode}, ${input.finalizedSlot.toString()}, now()
        )
        on conflict (release_mint) do update set
          source_snapshot = excluded.source_snapshot, source_snapshot_hash = excluded.source_snapshot_hash,
          icon_uri = excluded.icon_uri, screenshots = excluded.screenshots,
          banner_uri = excluded.banner_uri, feature_graphic_uri = excluded.feature_graphic_uri,
          validation_status = case
            when hub.releases.validation_status in ('validating_binary', 'server_binary_valid')
              and excluded.validation_status = 'metadata_valid'
              then hub.releases.validation_status
            else excluded.validation_status end,
          publication_status = case
            when hub.releases.publication_status in ('published', 'ignored', 'withdrawn') then hub.releases.publication_status
            else excluded.publication_status end,
          quarantine_code = excluded.quarantine_code, quarantine_detail = excluded.quarantine_detail,
          validated_at = now(), updated_at = now()
        returning id, validation_status, publication_status, quarantine_code
      `;
      if (!release) throw new Error("RELEASE_NOT_SAVED");
      const expected = {
        packageName: input.normalized.packageName,
        versionCode: input.normalized.versionCode.toString(),
        apkSha256: input.normalized.apkSha256,
        certificateSha256: input.normalized.certificateSha256
      };
      await tx`
        insert into hub.release_validation_runs (release_id, stage, provider, status, expected, observed, completed_at, failure_codes)
        values (${release.id}, 'metadata', 'finalized_token_metadata_v0.4.0',
          ${quarantineCode ? "failed" : "succeeded"}::hub.job_status, ${tx.json(expected)},
          ${tx.json(parseJsonValue(input.sourceSnapshotJson))},
          now(), ${quarantineCode ? [quarantineCode] : []})
      `;
      await tx`
        update hub.apps set short_description = ${input.normalized.shortDescription}, description = ${input.normalized.description},
          icon_uri = ${input.normalized.iconUri}, screenshots = ${tx.json([...input.normalized.screenshots])}, updated_at = now()
        where id = ${input.app.id}
      `;
      return {
        id: release.id,
        releaseMint: input.releaseMint,
        validationStatus: release.validation_status,
        publicationStatus: release.publication_status,
        quarantineCode: release.quarantine_code
      };
    });
  }
}
