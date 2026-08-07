import type { HubSql } from "./client";

export interface AdminAppSummary {
  id: string;
  name: string;
  appMint: string;
  packageName: string;
  claimStatus: string;
  distributionEnabled: boolean;
  suspendedAt: Date | null;
}

export interface AdminReleaseSummary {
  id: string;
  appId: string;
  appName: string;
  releaseMint: string;
  versionName: string;
  versionCode: string;
  validationStatus: string;
  publicationStatus: string;
  quarantineCode: string | null;
  approvalStatus: string;
}

export interface AdminAuditSummary {
  id: string;
  actorWallet: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: Date;
}

export class AdminRepository {
  public constructor(private readonly sql: HubSql) {}

  public async overview(): Promise<{
    apps: readonly AdminAppSummary[];
    releases: readonly AdminReleaseSummary[];
    audits: readonly AdminAuditSummary[];
  }> {
    const [apps, releases, audits] = await Promise.all([
      this.sql<{
        id: string; name: string; app_mint: string; package_name: string; claim_status: string;
        distribution_enabled: boolean; suspended_at: Date | null;
      }[]>`
        select id, name, app_mint, package_name, claim_status, distribution_enabled, suspended_at
        from hub.apps order by updated_at desc limit 100
      `,
      this.sql<{
        id: string; app_id: string; app_name: string; release_mint: string; version_name: string; version_code: string;
        validation_status: string; publication_status: string; quarantine_code: string | null; approval_status: string | null;
      }[]>`
        select r.id, r.app_id, a.name as app_name, r.release_mint, r.version_name, r.version_code::text,
          r.validation_status, r.publication_status, r.quarantine_code, approval.status as approval_status
        from hub.releases r join hub.apps a on a.id = r.app_id
        left join lateral (
          select status from hub.release_approvals where release_id = r.id and superseded_at is null order by created_at desc limit 1
        ) approval on true
        order by r.updated_at desc limit 200
      `,
      this.sql<{
        id: string; actor_wallet: string; action: string; target_type: string; target_id: string; reason: string; created_at: Date;
      }[]>`
        select id, actor_wallet, action, target_type, target_id, reason, created_at
        from hub.admin_audit_logs order by created_at desc limit 100
      `
    ]);
    return {
      apps: apps.map((row) => ({
        id: row.id, name: row.name, appMint: row.app_mint, packageName: row.package_name,
        claimStatus: row.claim_status, distributionEnabled: row.distribution_enabled, suspendedAt: row.suspended_at
      })),
      releases: releases.map((row) => ({
        id: row.id, appId: row.app_id, appName: row.app_name, releaseMint: row.release_mint,
        versionName: row.version_name, versionCode: row.version_code, validationStatus: row.validation_status,
        publicationStatus: row.publication_status, quarantineCode: row.quarantine_code,
        approvalStatus: row.approval_status ?? "unknown"
      })),
      audits: audits.map((row) => ({
        id: row.id, actorWallet: row.actor_wallet, action: row.action, targetType: row.target_type,
        targetId: row.target_id, reason: row.reason, createdAt: row.created_at
      }))
    };
  }

  public async setApproval(input: {
    releaseId: string;
    status: "verified_approved" | "rejected";
    sourceReference: string;
    evidenceJson: string;
    actorWallet: string;
    reason: string;
    requestId: string;
  }): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [release] = await tx<{ id: string; previous_status: string | null }[]>`
        select r.id, current.status as previous_status from hub.releases r
        left join lateral (
          select status from hub.release_approvals where release_id = r.id and superseded_at is null order by created_at desc limit 1
        ) current on true
        where r.id = ${input.releaseId} for update of r
      `;
      if (!release) throw new Error("RELEASE_NOT_FOUND");
      await tx`update hub.release_approvals set superseded_at = now() where release_id = ${input.releaseId} and superseded_at is null`;
      await tx`
        insert into hub.release_approvals (release_id, status, source, source_reference, evidence, verified_by_wallet, verified_at)
        values (${input.releaseId}, ${input.status}, 'manual_admin', ${input.sourceReference}, ${input.evidenceJson}::jsonb,
          ${input.actorWallet}, now())
      `;
      await tx`
        insert into hub.admin_audit_logs (actor_wallet, action, target_type, target_id, reason, before_snapshot, after_snapshot, request_id)
        values (${input.actorWallet}, 'release_approval_set', 'release', ${input.releaseId}, ${input.reason},
          ${JSON.stringify({ status: release.previous_status ?? "unknown" })}::jsonb,
          ${JSON.stringify({ status: input.status, sourceReference: input.sourceReference })}::jsonb, ${input.requestId})
      `;
    });
  }

  public async suspendApp(input: { appId: string; actorWallet: string; reason: string; requestId: string }): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [app] = await tx<{ id: string; claim_status: string; distribution_enabled: boolean }[]>`
        select id, claim_status, distribution_enabled from hub.apps where id = ${input.appId} for update
      `;
      if (!app) throw new Error("APP_NOT_FOUND");
      await tx`
        update hub.apps set claim_status = 'suspended', distribution_enabled = false, suspended_at = now(),
          suspension_reason = ${input.reason}, updated_at = now() where id = ${input.appId}
      `;
      await tx`
        update hub.releases set publication_status = 'withdrawn', updated_at = now()
        where app_id = ${input.appId} and publication_status in ('preview', 'published')
      `;
      await tx`
        insert into hub.admin_audit_logs (actor_wallet, action, target_type, target_id, reason, before_snapshot, after_snapshot, request_id)
        values (${input.actorWallet}, 'app_suspended', 'app', ${input.appId}, ${input.reason},
          ${JSON.stringify({ claimStatus: app.claim_status, distributionEnabled: app.distribution_enabled })}::jsonb,
          '{"claimStatus":"suspended","distributionEnabled":false}'::jsonb, ${input.requestId})
      `;
    });
  }
}
