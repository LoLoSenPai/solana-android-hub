import { randomUUID } from "node:crypto";
import type { AppEnvironment } from "@hub/domain";
import type { JSONValue } from "postgres";
import type { HubSql } from "./client";
import { parseJsonValue } from "./json";

export interface BinaryValidationManifest {
  runId: string;
  apkUrl: string;
  expectedSize: number;
  expectedSha256: string;
  packageName: string;
  versionCode: string;
  certificateSha256: string;
  minSdk: number;
  permissions: readonly string[];
}

export interface BinaryValidationResult {
  status: "succeeded" | "failed";
  observed?: Record<string, unknown>;
  failureCodes: readonly string[];
  toolVersions?: Record<string, unknown>;
  logDigest?: string;
}

export interface BinaryValidationRequest {
  manifest: BinaryValidationManifest;
  created: boolean;
}

interface ValidationRow {
  correlation_id: string;
  expected: JSONValue;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export class ValidationRepository {
  public constructor(private readonly sql: HubSql) {}

  public async createBinaryRun(releaseId: string, publisherId: string): Promise<BinaryValidationRequest> {
    return this.sql.begin(async (tx) => {
      const [release] = await tx<{
        release_id: string;
        apk_uri: string;
        apk_size: string;
        apk_sha256: string;
        package_name: string;
        version_code: string;
        certificate_sha256: string;
        min_sdk: number;
        permissions: string[];
        validation_status: string;
      }[]>`
        select r.id as release_id, r.apk_uri, r.apk_size::text, r.apk_sha256, r.package_name,
          r.version_code::text, r.certificate_sha256, r.min_sdk, r.permissions, r.validation_status
        from hub.releases r
        join hub.apps a on a.id = r.app_id
        where r.id = ${releaseId} and a.publisher_id = ${publisherId}
          and a.claim_status = 'verified' and a.distribution_enabled = true
          and a.suspended_at is null and a.revoked_at is null
        for update
      `;
      if (!release) throw new Error("RELEASE_NOT_FOUND");
      if (!['metadata_valid', 'validating_binary'].includes(release.validation_status)) {
        throw new Error(release.validation_status === "server_binary_valid" ? "RELEASE_ALREADY_VALIDATED" : "RELEASE_NOT_VALIDATABLE");
      }
      const [active] = await tx<{ correlation_id: string; expected: JSONValue }[]>`
        select correlation_id, expected from hub.release_validation_runs
        where release_id = ${releaseId} and stage = 'binary' and status in ('queued', 'running')
        order by created_at desc limit 1
      `;
      if (active) {
        const restored = decodeBinaryValidationManifest(active.expected, active.correlation_id);
        if (restored) return { manifest: restored, created: false };
        await tx`
          update hub.release_validation_runs set status = 'failed', completed_at = now(),
            failure_codes = array['MANIFEST_INVALID']
          where correlation_id = ${active.correlation_id} and status in ('queued', 'running')
        `;
      }

      const correlationId = randomUUID();
      const manifest: BinaryValidationManifest = {
        runId: correlationId,
        apkUrl: release.apk_uri,
        expectedSize: Number(release.apk_size),
        expectedSha256: release.apk_sha256,
        packageName: release.package_name,
        versionCode: release.version_code,
        certificateSha256: release.certificate_sha256,
        minSdk: release.min_sdk,
        permissions: [...release.permissions].sort()
      };
      await tx`
        insert into hub.release_validation_runs (release_id, stage, provider, status, correlation_id, expected)
        values (${releaseId}, 'binary', 'github_actions_ephemeral', 'queued', ${correlationId},
          ${tx.json(parseJsonValue(JSON.stringify(manifest)))})
      `;
      await tx`update hub.releases set validation_status = 'validating_binary', updated_at = now() where id = ${releaseId}`;
      return { manifest, created: true };
    });
  }

  public async failToSchedule(runId: string, detail: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [run] = await tx<{ release_id: string }[]>`
        update hub.release_validation_runs set status = 'failed', completed_at = now(),
          failure_codes = array['VALIDATOR_DISPATCH_FAILED'],
          observed = ${tx.json(parseJsonValue(JSON.stringify({ detail: detail.slice(0, 500) })))}
        where correlation_id = ${runId} and status = 'queued'
        returning release_id
      `;
      if (run) await tx`update hub.releases set validation_status = 'metadata_valid', updated_at = now() where id = ${run.release_id}`;
    });
  }

  public async getManifest(runId: string): Promise<BinaryValidationManifest | null> {
    const [run] = await this.sql<ValidationRow[]>`
      update hub.release_validation_runs set status = 'running', started_at = coalesce(started_at, now())
      where correlation_id = ${runId} and stage = 'binary' and status in ('queued', 'running')
      returning correlation_id, expected, status
    `;
    return run ? decodeBinaryValidationManifest(run.expected, run.correlation_id) : null;
  }

  public async completeBinaryRun(input: {
    runId: string;
    result: BinaryValidationResult;
    resultAccepted: boolean;
    oidcSubject: string;
    oidcReplayKeyHash: string;
    environment: AppEnvironment;
  }): Promise<"succeeded" | "failed"> {
    return this.sql.begin(async (tx) => {
      const [run] = await tx<{ release_id: string; status: string }[]>`
        select release_id, status from hub.release_validation_runs
        where correlation_id = ${input.runId} and stage = 'binary' for update
      `;
      if (!run) throw new Error("VALIDATION_RUN_NOT_FOUND");
      if (!['queued', 'running'].includes(run.status)) throw new Error("VALIDATION_RESULT_REPLAYED");
      const succeeded = input.result.status === "succeeded" && input.resultAccepted;
      const status = succeeded ? "succeeded" : "failed";
      const failures = succeeded
        ? []
        : [...new Set(input.result.failureCodes.length > 0 ? input.result.failureCodes : ["VALIDATOR_RESULT_MISMATCH"])];
      await tx`
        update hub.release_validation_runs set status = ${status}::hub.job_status,
          observed = ${tx.json(parseJsonValue(JSON.stringify(input.result.observed ?? {})))},
          tool_versions = ${tx.json(parseJsonValue(JSON.stringify(input.result.toolVersions ?? {})))},
          failure_codes = ${failures}, log_digest = ${input.result.logDigest ?? null},
          oidc_subject = ${input.oidcSubject}, oidc_replay_key_hash = ${input.oidcReplayKeyHash}, completed_at = now()
        where correlation_id = ${input.runId}
      `;
      await tx`
        update hub.releases set validation_status = ${succeeded ? "server_binary_valid" : "metadata_valid"}::hub.release_validation_status,
          updated_at = now()
        where id = ${run.release_id}
      `;
      if (succeeded) {
        await tx`
          update hub.releases r set publication_status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
          from hub.apps a
          where r.id = ${run.release_id} and r.app_id = a.id and a.release_policy = 'automatic'
            and a.claim_status = 'verified' and a.distribution_enabled = true and a.suspended_at is null and a.revoked_at is null
            and exists (
              select 1 from hub.distribution_consents dc where dc.app_id = a.id
                and dc.environment = ${input.environment}::hub.app_environment and dc.status = 'active' and dc.superseded_at is null
            )
        `;
      }
      return status;
    });
  }

  public async publishValidatedRelease(releaseId: string, publisherId: string, environment: "local" | "staging" | "production") {
    const [release] = await this.sql<{ id: string; publication_status: string }[]>`
      update hub.releases r set publication_status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
      from hub.apps a
      where r.id = ${releaseId} and r.app_id = a.id and a.publisher_id = ${publisherId}
        and r.validation_status = 'server_binary_valid' and r.quarantine_code is null
        and a.claim_status = 'verified' and a.distribution_enabled = true and a.suspended_at is null and a.revoked_at is null
        and exists (
          select 1 from hub.distribution_consents dc where dc.app_id = a.id
            and dc.environment = ${environment}::hub.app_environment and dc.status = 'active' and dc.superseded_at is null
        )
      returning r.id, r.publication_status
    `;
    if (!release) throw new Error("RELEASE_NOT_PUBLISHABLE");
    return release;
  }
}

export function decodeBinaryValidationManifest(value: unknown, runId: string): BinaryValidationManifest | null {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (typeof record.apkUrl !== "string" || typeof record.expectedSize !== "number"
    || typeof record.expectedSha256 !== "string" || typeof record.packageName !== "string"
    || typeof record.versionCode !== "string" || typeof record.certificateSha256 !== "string"
    || typeof record.minSdk !== "number" || !Array.isArray(record.permissions)
    || record.permissions.some((permission) => typeof permission !== "string")) return null;
  return {
    runId,
    apkUrl: record.apkUrl,
    expectedSize: record.expectedSize,
    expectedSha256: record.expectedSha256,
    packageName: record.packageName,
    versionCode: record.versionCode,
    certificateSha256: record.certificateSha256,
    minSdk: record.minSdk,
    permissions: record.permissions as string[]
  };
}
