import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase, type HubSql } from "../src/client.js";
import { parseJsonValue } from "../src/json.js";
import { ValidationRepository, type BinaryValidationResult } from "../src/validation-repository.js";

// Opt in only against a disposable, migrated PostgreSQL database.
const databaseUrl = process.env.DATABASE_TEST_URL;
describe.skipIf(!databaseUrl)("binary validation lifecycle (PostgreSQL)", () => {
  let sql: HubSql;
  let repository: ValidationRepository;
  const publishers: string[] = [];

  beforeAll(() => {
    sql = connectDatabase(databaseUrl!);
    repository = new ValidationRepository(sql);
  });

  afterAll(async () => {
    if (!sql) return;
    try {
      for (const publisher of publishers) {
        await sql`delete from hub.distribution_consents where app_id in (select id from hub.apps where publisher_id = ${publisher})`;
        await sql`delete from hub.releases where app_id in (select id from hub.apps where publisher_id = ${publisher})`;
        await sql`delete from hub.apps where publisher_id = ${publisher}`;
        await sql`delete from hub.publisher_wallets where publisher_id = ${publisher}`;
        await sql`delete from hub.publishers where id = ${publisher}`;
      }
    } finally {
      await sql.end();
    }
  });

  async function fixture(consent = false) {
    const publisherId = randomUUID();
    const appId = randomUUID();
    const releaseId = randomUUID();
    const walletId = randomUUID();
    const suffix = randomUUID().replaceAll("-", "");
    // Hex characters excluding zero form a valid base58 fixture mint.
    const mint = suffix.replaceAll("0", "1");
    const digest = "a".repeat(64);
    publishers.push(publisherId);
    await sql`insert into hub.publishers (id, display_name) values (${publisherId}, 'Validation integration QA')`;
    await sql`insert into hub.publisher_wallets (id, publisher_id, wallet_address)
      values (${walletId}, ${publisherId}, ${mint})`;
    await sql`insert into hub.apps (id, publisher_id, app_mint, publisher_mint, package_name, slug,
      name, metadata_uri, source_snapshot, source_snapshot_hash, claim_status, release_policy, distribution_enabled)
      values (${appId}, ${publisherId}, ${mint}, ${mint}, ${`qa.integration.p${suffix}`}, ${`qa-${suffix}`},
        'Validation QA', 'https://qa.example/metadata', '{}'::jsonb, ${digest}, 'verified', 'automatic', true)`;
    await sql`insert into hub.releases (id, app_id, release_mint, metadata_uri, source_snapshot,
      source_snapshot_hash, package_name, version_name, version_code, apk_uri, apk_size, apk_sha256,
      certificate_sha256, min_sdk, permissions, collection_verified, metadata_immutable, discovered_slot, validation_status)
      values (${releaseId}, ${appId}, ${mint}, 'https://qa.example/release', '{}'::jsonb,
        ${digest}, ${`qa.integration.p${suffix}`}, '1.0', 1, 'https://qa.example/app.apk', 1234, ${digest},
        ${digest}, 26, array['android.permission.INTERNET'], true, true, 1, 'metadata_valid')`;
    if (consent) {
      await sql`insert into hub.distribution_consents (app_id, publisher_wallet_id, environment, message,
        signature, nonce_hash, scopes, release_policy, terms_version, issued_at, signing_expires_at, verified_at)
        values (${appId}, ${walletId}, 'local', 'QA consent', 'QA signature', ${Buffer.from(suffix)},
          array['facilitate_apk_installation','list_app','monitor_future_releases','use_public_metadata'],
          'automatic', 'qa', now(), now() + interval '10 minutes', now())`;
    }
    return { publisherId, appId, releaseId };
  }

  async function releaseState(releaseId: string) {
    const [row] = await sql`select validation_status, publication_status, published_at from hub.releases where id = ${releaseId}`;
    return row;
  }

  async function ageRun(runId: string, running = false) {
    await sql`update hub.release_validation_runs set created_at = now() - interval '2 hours',
      started_at = ${running ? new Date(Date.now() - 46 * 60_000) : null},
      status = ${running ? "running" : "queued"}::hub.job_status where correlation_id = ${runId}`;
  }

  function callback(runId: string, result?: BinaryValidationResult) {
    return {
      runId,
      result: result ?? { status: "succeeded" as const, observed: { packageName: "qa.integration" },
        failureCodes: [], toolVersions: { apkanalyzer: "1" }, logDigest: "b".repeat(64) },
      resultAccepted: true,
      oidcSubject: "repo:qa/validator:ref:refs/heads/main",
      oidcReplayKeyHash: randomUUID().replaceAll("-", ""),
      environment: "local" as const
    };
  }

  it("serializes concurrent creation and reuses a fresh queued/running run", async () => {
    const f = await fixture();
    const results = await Promise.all(Array.from({ length: 6 }, () => repository.createBinaryRun(f.releaseId, f.publisherId)));
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.manifest.runId)).size).toBe(1);
    const runId = results[0]!.manifest.runId;
    await repository.getManifest(runId);
    const active = await repository.createBinaryRun(f.releaseId, f.publisherId);
    expect(active.created).toBe(false);
    expect(active.manifest.runId).toBe(runId);
    const [countRow] = await sql`select count(*)::int as count from hub.release_validation_runs where release_id = ${f.releaseId}`;
    expect(countRow!.count).toBe(1);
  });

  it.each([false, true])("replaces an expired active run (running=%s) and rejects its late callback", async (running) => {
    const f = await fixture(true);
    const old = await repository.createBinaryRun(f.releaseId, f.publisherId);
    await ageRun(old.manifest.runId, running);
    const replacement = await repository.createBinaryRun(f.releaseId, f.publisherId);
    expect(replacement.created).toBe(true);
    expect(replacement.manifest.runId).not.toBe(old.manifest.runId);
    const [expired] = await sql`select status, failure_codes, completed_at from hub.release_validation_runs where correlation_id = ${old.manifest.runId}`;
    expect(expired!.status).toBe("failed");
    expect(expired!.failure_codes).toContain("VALIDATOR_TIMEOUT");
    expect(expired!.completed_at).not.toBeNull();
    await expect(repository.completeBinaryRun(callback(old.manifest.runId))).rejects.toThrow();
    expect(await repository.getManifest(old.manifest.runId)).toBeNull();
    expect(await releaseState(f.releaseId)).toMatchObject({ validation_status: "validating_binary", publication_status: "unpublished", published_at: null });
  });

  it("measures running timeout from started_at rather than queued creation", async () => {
    const f = await fixture();
    const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
    await sql`update hub.release_validation_runs set created_at = now() - interval '2 hours',
      started_at = now(), status = 'running' where correlation_id = ${run.manifest.runId}`;
    expect((await repository.createBinaryRun(f.releaseId, f.publisherId)).created).toBe(false);
    await repository.expireStaleBinaryRuns();
    expect(await repository.getManifest(run.manifest.runId)).not.toBeNull();
  });

  it("expires queued/running work, resets only validating releases, and never publishes", async () => {
    const first = await fixture(true);
    const second = await fixture(true);
    const untouched = await fixture(true);
    const fresh = await fixture(true);
    for (const [index, f] of [first, second, untouched].entries()) {
      const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
      await ageRun(run.manifest.runId, index > 0);
    }
    const freshRun = await repository.createBinaryRun(fresh.releaseId, fresh.publisherId);
    await sql`update hub.releases set validation_status = 'quarantined' where id = ${untouched.releaseId}`;
    await repository.expireStaleBinaryRuns();
    for (const f of [first, second]) {
      expect(await releaseState(f.releaseId)).toMatchObject({ validation_status: "metadata_valid", publication_status: "unpublished", published_at: null });
      const [run] = await sql`select status, failure_codes, completed_at from hub.release_validation_runs where release_id = ${f.releaseId}`;
      expect(run!.status).toBe("failed");
      expect(run!.failure_codes).toContain("VALIDATOR_TIMEOUT");
      expect(run!.completed_at).not.toBeNull();
    }
    expect(await releaseState(untouched.releaseId)).toMatchObject({ validation_status: "quarantined", publication_status: "unpublished" });
    expect(await repository.getManifest(freshRun.manifest.runId)).not.toBeNull();
    await repository.expireStaleBinaryRuns();
    expect((await releaseState(first.releaseId))!.publication_status).toBe("unpublished");
  });

  it("accepts identical result retries only for the same OIDC identity", async () => {
    const f = await fixture(true);
    const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
    const input = callback(run.manifest.runId);
    await expect(repository.completeBinaryRun(input)).resolves.toBe("succeeded");
    const firstState = await releaseState(f.releaseId);
    await expect(repository.completeBinaryRun(input)).resolves.toBe("succeeded");
    await expect(repository.completeBinaryRun({ ...input, oidcSubject: "repo:other/validator" })).rejects.toThrow();
    await expect(repository.completeBinaryRun({ ...input, oidcReplayKeyHash: "different-identity" })).rejects.toThrow();
    for (const change of [
      { observed: { changed: true } }, { toolVersions: { changed: "2" } },
      { logDigest: "changed" }, { failureCodes: ["DIFFERENT"] }, { status: "failed" as const }
    ]) {
      await expect(repository.completeBinaryRun({ ...input, result: { ...input.result, ...change } })).rejects.toThrow();
    }
    await expect(repository.completeBinaryRun({ ...input, resultAccepted: false })).rejects.toThrow();
    expect(await releaseState(f.releaseId)).toEqual(firstState);
    expect(firstState).toMatchObject({ validation_status: "server_binary_valid", publication_status: "published" });
    expect(firstState!.published_at).not.toBeNull();
  });

  it("keeps owner isolation and requires accepted success plus matching consent to publish", async () => {
    const owner = await fixture(true);
    const outsider = await fixture();
    await expect(repository.createBinaryRun(owner.releaseId, outsider.publisherId)).rejects.toThrow("RELEASE_NOT_FOUND");
    const noConsent = await repository.createBinaryRun(outsider.releaseId, outsider.publisherId);
    await repository.completeBinaryRun(callback(noConsent.manifest.runId));
    expect(await releaseState(outsider.releaseId)).toMatchObject({ validation_status: "server_binary_valid", publication_status: "unpublished" });
    const ownerRun = await repository.createBinaryRun(owner.releaseId, owner.publisherId);
    const rejected = { ...callback(ownerRun.manifest.runId), resultAccepted: false };
    await expect(repository.completeBinaryRun(rejected)).resolves.toBe("failed");
    await expect(repository.completeBinaryRun(rejected)).resolves.toBe("failed");
    expect(await releaseState(owner.releaseId)).toMatchObject({ validation_status: "metadata_valid", publication_status: "unpublished" });
    const retry = await repository.createBinaryRun(owner.releaseId, owner.publisherId);
    await repository.completeBinaryRun({ ...callback(retry.manifest.runId), environment: "staging" });
    expect(await releaseState(owner.releaseId)).toMatchObject({ validation_status: "server_binary_valid", publication_status: "unpublished" });
  });

  it("serializes expiration against a callback without mixed terminal state", async () => {
    // Both winners are valid: the callback commits first, or expiry fences it out.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const f = await fixture(true);
      const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
      await ageRun(run.manifest.runId, true);
      const input = callback(run.manifest.runId);
      const callbackFirst = attempt % 2 === 0;
      const operations = callbackFirst
        ? [repository.completeBinaryRun(input), repository.expireStaleBinaryRuns()]
        : [repository.expireStaleBinaryRuns(), repository.completeBinaryRun(input)];
      const results = await Promise.allSettled(operations);
      const expiry = results[callbackFirst ? 1 : 0]!;
      expect(expiry.status).toBe("fulfilled");
      const completion = results[callbackFirst ? 0 : 1]!;
      const [stored] = await sql`select status, failure_codes, completed_at from hub.release_validation_runs where correlation_id = ${run.manifest.runId}`;
      expect(stored!.completed_at).not.toBeNull();
      if (completion.status === "fulfilled") {
        expect(completion.value).toBe("succeeded");
        expect(stored!.status).toBe("succeeded");
        expect(await releaseState(f.releaseId)).toMatchObject({ validation_status: "server_binary_valid", publication_status: "published" });
      } else {
        expect(stored!.status).toBe("failed");
        expect(stored!.failure_codes).toContain("VALIDATOR_TIMEOUT");
        expect(await releaseState(f.releaseId)).toMatchObject({ validation_status: "metadata_valid", publication_status: "unpublished", published_at: null });
      }
    }
  });

  it("expires a bounded batch and preserves a release with a fresh active run", async () => {
    const fixtures = await Promise.all([fixture(), fixture(), fixture()]);
    for (const f of fixtures) {
      const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
      await ageRun(run.manifest.runId);
    }
    expect(await repository.expireStaleBinaryRuns(1)).toBe(1);
    expect(await repository.expireStaleBinaryRuns()).toBe(2);
    const f = await fixture();
    const fresh = await repository.createBinaryRun(f.releaseId, f.publisherId);
    const legacyId = randomUUID();
    await sql`insert into hub.release_validation_runs (release_id, stage, provider, status, correlation_id, expected, created_at)
      values (${f.releaseId}, 'binary', 'qa', 'queued', ${legacyId}, ${sql.json(parseJsonValue(JSON.stringify(fresh.manifest)))}, now() - interval '2 hours')`;
    expect(await repository.expireStaleBinaryRuns()).toBe(1);
    expect(await releaseState(f.releaseId)).toMatchObject({ validation_status: "validating_binary", publication_status: "unpublished" });
    expect(await repository.getManifest(fresh.manifest.runId)).not.toBeNull();
    expect(await repository.getManifest(legacyId)).toBeNull();
  });

  it("serializes identical concurrent callbacks and keeps stored-manifest reads read-only", async () => {
    const f = await fixture(true);
    const run = await repository.createBinaryRun(f.releaseId, f.publisherId);
    expect(await repository.getStoredManifest(run.manifest.runId)).toEqual(run.manifest);
    const [queued] = await sql`select status, started_at from hub.release_validation_runs where correlation_id = ${run.manifest.runId}`;
    expect(queued).toMatchObject({ status: "queued", started_at: null });
    const input = callback(run.manifest.runId);
    expect(await Promise.all(Array.from({ length: 4 }, () => repository.completeBinaryRun(input))))
      .toEqual(["succeeded", "succeeded", "succeeded", "succeeded"]);
    expect(await repository.getStoredManifest(run.manifest.runId)).toEqual(run.manifest);
    const [finished] = await sql`select status, completed_at from hub.release_validation_runs where correlation_id = ${run.manifest.runId}`;
    expect(finished!.status).toBe("succeeded");
    expect(finished!.completed_at).not.toBeNull();
  });
});
