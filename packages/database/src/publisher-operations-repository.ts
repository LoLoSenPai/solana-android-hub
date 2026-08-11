import type { AppEnvironment, CatalogCategory, GameGenre } from "@hub/domain";
import type { HubSql } from "./client";

export interface PublisherAppSummary {
  id: string;
  appMint: string;
  slug: string;
  name: string;
  packageName: string;
  claimStatus: string;
  distributionEnabled: boolean;
  releasePolicy: string;
  consentStatus: string | null;
  releaseCount: string;
  category: CatalogCategory;
  genres: readonly GameGenre[];
}

export class PublisherOperationsRepository {
  public constructor(private readonly sql: HubSql) {}

  public async listApps(publisherId: string, environment: AppEnvironment): Promise<readonly PublisherAppSummary[]> {
    const rows = await this.sql<{
      id: string; app_mint: string; slug: string; name: string; package_name: string; claim_status: string;
      distribution_enabled: boolean; release_policy: string; consent_status: string | null; release_count: string;
      primary_category: CatalogCategory | null; tags: GameGenre[] | null;
    }[]>`
      select a.id, a.app_mint, a.slug, a.name, a.package_name, a.claim_status, a.distribution_enabled, a.release_policy,
        consent.status as consent_status, count(r.id)::text as release_count,
        classification.primary_category, classification.tags
      from hub.apps a
      left join hub.releases r on r.app_id = a.id
      left join hub.app_classifications classification on classification.app_id = a.id
      left join lateral (
        select status from hub.distribution_consents where app_id = a.id
          and environment = ${environment}::hub.app_environment and superseded_at is null
        order by created_at desc limit 1
      ) consent on true
      where a.publisher_id = ${publisherId}
      group by a.id, consent.status, classification.primary_category, classification.tags order by a.updated_at desc
    `;
    return rows.map((row) => ({
      id: row.id,
      appMint: row.app_mint,
      slug: row.slug,
      name: row.name,
      packageName: row.package_name,
      claimStatus: row.claim_status,
      distributionEnabled: row.distribution_enabled,
      releasePolicy: row.release_policy,
      consentStatus: row.consent_status,
      releaseCount: row.release_count,
      category: row.primary_category ?? "other",
      genres: row.tags ?? []
    }));
  }

  public async listReleases(appId: string, publisherId: string) {
    return this.sql<{
      id: string; release_mint: string; version_name: string; version_code: string; validation_status: string;
      publication_status: string; quarantine_code: string | null; created_at: Date;
      validation_failure_codes: string[];
    }[]>`
      select r.id, r.release_mint, r.version_name, r.version_code::text, r.validation_status,
        r.publication_status, r.quarantine_code, r.discovered_at as created_at,
        coalesce(validation.failure_codes, array[]::text[]) as validation_failure_codes
      from hub.releases r join hub.apps a on a.id = r.app_id
      left join lateral (
        select failure_codes from hub.release_validation_runs
        where release_id = r.id and stage = 'binary' and status = 'failed'
        order by created_at desc limit 1
      ) validation on true
      where r.app_id = ${appId} and a.publisher_id = ${publisherId}
      order by r.version_code desc
    `;
  }

  public async revokeDistribution(appId: string, publisherId: string, environment: AppEnvironment): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      const [app] = await tx<{ id: string }[]>`
        select id from hub.apps where id = ${appId} and publisher_id = ${publisherId} for update
      `;
      if (!app) return false;
      await tx`
        update hub.distribution_consents set status = 'revoked', revoked_at = now(), revocation_reason = null
        where app_id = ${appId} and environment = ${environment}::hub.app_environment and status = 'active'
      `;
      await tx`
        update hub.apps set distribution_enabled = false, revoked_at = now(), updated_at = now() where id = ${appId}
      `;
      await tx`
        update hub.releases set publication_status = 'withdrawn', updated_at = now()
        where app_id = ${appId} and publication_status in ('preview', 'published')
      `;
      return true;
    });
  }

  public async ignoreRelease(releaseId: string, publisherId: string): Promise<boolean> {
    const [release] = await this.sql<{ id: string }[]>`
      update hub.releases r set publication_status = 'ignored', updated_at = now()
      from hub.apps a
      where r.id = ${releaseId} and r.app_id = a.id and a.publisher_id = ${publisherId}
        and r.publication_status in ('preview', 'unpublished')
      returning r.id
    `;
    return Boolean(release);
  }

  public async requestApproval(releaseId: string, publisherId: string, publisherWalletId: string, evidenceJson: string): Promise<string | null> {
    const [request] = await this.sql<{ id: string }[]>`
      insert into hub.approval_requests (release_id, publisher_wallet_id, evidence)
      select r.id, ${publisherWalletId}, ${evidenceJson}::jsonb
      from hub.releases r join hub.apps a on a.id = r.app_id
      where r.id = ${releaseId} and a.publisher_id = ${publisherId}
        and not exists (select 1 from hub.approval_requests existing where existing.release_id = r.id and existing.status = 'pending')
      returning id
    `;
    return request?.id ?? null;
  }
}
