import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase, type HubSql } from "../src/client.js";
import { PublicationHealthRepository } from "../src/publication-health-repository.js";

// Opt in only against a disposable, migrated PostgreSQL database.
const databaseUrl = process.env.DATABASE_TEST_URL;
const digest = "a".repeat(64);
const fresh = () => new Date();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const mint = () => randomUUID().replaceAll("-", "").replaceAll("0", "1");

describe.skipIf(!databaseUrl)("publication health (PostgreSQL)", () => {
  const rollback = new Error("rollback publication health fixture");
  const fixtureSlugs = new WeakMap<HubSql, Set<string>>();
  let connection: HubSql;

  beforeAll(() => { connection = connectDatabase(databaseUrl!); });
  afterAll(async () => { await connection.end(); });

  type Snapshot = Awaited<ReturnType<PublicationHealthRepository["read"]>>;

  async function withFixtures(test: (sql: HubSql, read: () => Promise<Snapshot>) => Promise<void>) {
    try {
      await connection.begin(async (tx) => {
        const sql = tx as unknown as HubSql;
        const slugs = new Set<string>();
        fixtureSlugs.set(sql, slugs);
        const repository = new PublicationHealthRepository(sql);
        await test(sql, async () => {
          const snapshot = await repository.read("production");
          return { ...snapshot, issues: snapshot.issues.filter((issue) => slugs.has(issue.app)) };
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  async function appFixture(sql: HubSql, options: {
    environment?: "staging" | "production";
    policy?: "manual" | "automatic";
    consentedAt?: Date;
    suspended?: boolean;
    sync?: "succeeded" | "failed" | "partial" | "missing";
  } = {}) {
    const appId = randomUUID();
    const publisherId = randomUUID();
    const walletId = randomUUID();
    const appMint = mint();
    const slug = `qa-health-${appId}`;
    fixtureSlugs.get(sql)!.add(slug);
    const packageName = `qa.health.p${appId.replaceAll("-", "")}`;
    const policy = options.policy ?? "automatic";
    await sql`insert into hub.publishers (id, display_name) values (${publisherId}, 'Publication health QA')`;
    await sql`insert into hub.publisher_wallets (id, publisher_id, wallet_address) values (${walletId}, ${publisherId}, ${appMint})`;
    await sql`
      insert into hub.apps (id, publisher_id, app_mint, publisher_mint, package_name, slug, name, metadata_uri,
        source_snapshot, source_snapshot_hash, claim_status, release_policy, distribution_enabled, suspended_at)
      values (${appId}, ${publisherId}, ${appMint}, ${appMint}, ${packageName}, ${slug}, 'Publication health QA',
        'https://qa.example/app', '{}'::jsonb, ${digest}, 'verified', ${policy}::hub.release_policy, true,
        ${options.suspended ? fresh() : null})
    `;
    await sql`
      insert into hub.app_claims (app_id, publisher_wallet_id, status, authority_path, finalized_slot, evidence_hash, evidence_snapshot, verified_at)
      values (${appId}, ${walletId}, 'verified', 'update_authority', 1, ${digest}, '{}'::jsonb, now())
    `;
    await sql`
      insert into hub.distribution_consents (app_id, publisher_wallet_id, environment, status, message, signature,
        nonce_hash, scopes, release_policy, terms_version, issued_at, signing_expires_at, verified_at)
      values (${appId}, ${walletId}, ${options.environment ?? "production"}::hub.app_environment, 'active',
        'qa', 'qa', ${Buffer.from(appId)}, array['facilitate_apk_installation','list_app','monitor_future_releases','use_public_metadata'],
        ${policy}::hub.release_policy, 'qa', now() - interval '1 day', now() - interval '23 hours', ${options.consentedAt ?? minutesAgo(240)})
    `;
    if (options.sync !== "missing") {
      const status = options.sync === "failed" || options.sync === "partial" ? "failed" : "succeeded";
      const errorCode = options.sync === "partial" ? "SYNC_INCOMPLETE" : options.sync === "failed" ? "RELEASE_SYNC_FAILED" : null;
      await sql`insert into hub.sync_jobs (app_id, kind, status, completed_at, error_code)
        values (${appId}, 'scheduled', ${status}::hub.job_status, now(), ${errorCode})`;
    }
    return { appId, slug, packageName };
  }

  async function releaseFixture(sql: HubSql, app: { appId: string; packageName: string }, options: {
    version?: number;
    publication?: "published" | "unpublished";
    validation?: "metadata_valid" | "validating_binary" | "server_binary_valid" | "quarantined";
    discoveredAt?: Date;
  } = {}) {
    const id = randomUUID();
    await sql`
      insert into hub.releases (id, app_id, release_mint, metadata_uri, source_snapshot, source_snapshot_hash,
        package_name, version_name, version_code, apk_uri, apk_size, apk_sha256, certificate_sha256, min_sdk,
        collection_verified, metadata_immutable, discovered_slot, discovered_at, validation_status, publication_status)
      values (${id}, ${app.appId}, ${mint()}, 'https://qa.example/release', '{}'::jsonb, ${digest},
        ${app.packageName}, '1.0', ${options.version ?? 1}, 'https://qa.example/app.apk', 1234, ${digest}, ${digest}, 26,
        true, true, 1, ${options.discoveredAt ?? minutesAgo(120)},
        ${options.validation ?? "metadata_valid"}::hub.release_validation_status,
        ${options.publication ?? "unpublished"}::hub.publication_status)
    `;
    return id;
  }

  async function runFixture(sql: HubSql, releaseId: string, options: {
    status?: "queued" | "running" | "failed";
    failureCode?: string;
    detail?: string;
    createdAt?: Date;
    startedAt?: Date;
  } = {}) {
    const id = randomUUID();
    const status = options.status ?? "failed";
    await sql`
      insert into hub.release_validation_runs (correlation_id, release_id, stage, provider, status, expected, observed,
        failure_codes, created_at, started_at, completed_at)
      values (${id}, ${releaseId}, 'binary', 'github_actions_ephemeral', ${status}::hub.job_status,
        '{}'::jsonb, ${sql.json({ detail: options.detail ?? "" })}, ${options.failureCode ? [options.failureCode] : []},
        ${options.createdAt ?? fresh()}, ${options.startedAt ?? null}, ${status === "failed" ? fresh() : null})
    `;
    return id;
  }

  it("preserves the actionable 401 and clears it after a new attempt or publication", () => withFixtures(async (sql, read) => {
    const app = await appFixture(sql);
    const release = await releaseFixture(sql, app, { version: 502 });
    const validationId = await runFixture(sql, release, {
      failureCode: "VALIDATOR_DISPATCH_FAILED", detail: "VALIDATOR_DISPATCH_HTTP_401", createdAt: minutesAgo(1)
    });
    expect(await read()).toEqual({
      truncated: false, issues: [{ app: app.slug, code: "VALIDATOR_DISPATCH_HTTP_401", validationId, version: "502" }]
    });
    const recoveryId = await runFixture(sql, release, { status: "queued" });
    expect((await read()).issues).toEqual([]);
    await sql`update hub.releases set publication_status = 'published', validation_status = 'server_binary_valid' where id = ${release}`;
    await sql`delete from hub.release_validation_runs where correlation_id = ${recoveryId}`;
    expect((await read()).issues).toEqual([]);
  }));

  it("alerts on overdue pipeline work while excluding fresh, intentionally manual and superseded releases", () => withFixtures(async (sql, read) => {
    const missing = await appFixture(sql);
    await releaseFixture(sql, missing);
    const overdue = await appFixture(sql);
    const overdueId = await releaseFixture(sql, overdue);
    const runId = await runFixture(sql, overdueId, { status: "running", createdAt: minutesAgo(60), startedAt: minutesAgo(46) });
    const starting = await appFixture(sql);
    await runFixture(sql, await releaseFixture(sql, starting), { status: "running", createdAt: minutesAgo(60), startedAt: fresh() });
    const veryNew = await appFixture(sql);
    await releaseFixture(sql, veryNew, { discoveredAt: fresh() });
    const manual = await appFixture(sql, { policy: "manual" });
    await releaseFixture(sql, manual, { validation: "server_binary_valid" });
    const superseded = await appFixture(sql);
    await runFixture(sql, await releaseFixture(sql, superseded), { failureCode: "VALIDATOR_DISPATCH_FAILED" });
    await releaseFixture(sql, superseded, { version: 2, validation: "server_binary_valid", publication: "published" });
    const refused = await appFixture(sql);
    await runFixture(sql, await releaseFixture(sql, refused), { failureCode: "APK_SHA256_MISMATCH" });
    const blocked = await appFixture(sql);
    await releaseFixture(sql, blocked, { validation: "server_binary_valid" });
    const staging = await appFixture(sql, { environment: "staging" });
    await releaseFixture(sql, staging);
    const suspended = await appFixture(sql, { suspended: true });
    await releaseFixture(sql, suspended);

    const { issues } = await read();
    expect(issues).toHaveLength(3);
    expect(issues).toEqual(expect.arrayContaining([
      { app: overdue.slug, code: "VALIDATOR_OVERDUE", validationId: runId, version: "1" },
      { app: missing.slug, code: "VALIDATOR_NOT_STARTED", validationId: null, version: "1" },
      { app: blocked.slug, code: "AUTOMATIC_PUBLICATION_PENDING", validationId: null, version: "1" }
    ]));
  }));

  it("alerts on missing or repeatedly failed scheduled synchronization after the grace period", () => withFixtures(async (sql, read) => {
    const overdue = await appFixture(sql, { sync: "missing" });
    const failing = await appFixture(sql, { sync: "failed" });
    await appFixture(sql, { sync: "missing", consentedAt: fresh() });
    await appFixture(sql, { sync: "partial" });
    await appFixture(sql);
    const { issues } = await read();
    expect(issues).toHaveLength(2);
    expect(issues).toEqual(expect.arrayContaining([
      { app: overdue.slug, code: "SCHEDULED_SYNC_OVERDUE", validationId: null, version: null },
      { app: failing.slug, code: "RELEASE_SYNC_FAILED", validationId: null, version: null }
    ]));
  }));

  it("keeps a timed-out queue visible across re-enqueue until a validator starts", () => withFixtures(async (sql, read) => {
    const app = await appFixture(sql);
    const release = await releaseFixture(sql, app);
    const expired = await runFixture(sql, release, { status: "queued", createdAt: minutesAgo(46), startedAt: fresh() });
    const issue = { app: app.slug, code: "VALIDATOR_OVERDUE", version: "1" };
    expect((await read()).issues).toEqual([{ ...issue, validationId: expired }]);
    await sql`update hub.release_validation_runs set status = 'failed', completed_at = now(),
      failure_codes = array['VALIDATOR_TIMEOUT'] where correlation_id = ${expired}`;
    const retry = await runFixture(sql, release, { status: "queued" });
    expect((await read()).issues).toEqual([{ ...issue, validationId: retry }]);
    await sql`update hub.release_validation_runs set status = 'running', started_at = now() where correlation_id = ${retry}`;
    expect((await read()).issues).toEqual([]);
  }));
});
