import {
  normalizeCatalogCategory,
  type AppEligibility,
  type AppEnvironment,
  type ApprovalStatus,
  type CatalogCategory,
  type ReleaseCandidate
} from "@hub/domain";
import type { HubSql } from "./client";

export interface CatalogAppRecord {
  id: string;
  appMint: string;
  slug: string;
  packageName: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  iconUri: string | null;
  screenshots: readonly string[];
  category: CatalogCategory;
  eligibility: AppEligibility;
  release: ReleaseCandidate;
  binary: {
    apkUri: string;
    apkSize: number;
    apkSha256: string;
    minSdk: number;
    targetSdk: number | null;
  };
  releaseUpdatedAt: Date;
}

interface CatalogRow {
  app_id: string;
  app_mint: string;
  slug: string;
  package_name: string;
  app_name: string;
  short_description: string | null;
  description: string | null;
  icon_uri: string | null;
  screenshots: unknown;
  source_category: string | null;
  claim_status: AppEligibility["claimStatus"];
  authority_address: string | null;
  distribution_enabled: boolean;
  consent_status: AppEligibility["consentStatus"];
  consent_environment: AppEnvironment;
  release_id: string;
  release_mint: string;
  version_name: string;
  version_code: string;
  certificate_sha256: string;
  apk_uri: string;
  apk_size: string;
  apk_sha256: string;
  min_sdk: number;
  target_sdk: number | null;
  permissions: string[];
  validation_status: ReleaseCandidate["validationStatus"];
  publication_status: ReleaseCandidate["publicationStatus"];
  approval_status: ApprovalStatus | null;
  release_updated_at: Date;
}

export class CatalogRepository {
  public constructor(private readonly sql: HubSql) {}

  public async listReleaseCandidates(environment: AppEnvironment, query?: string, changedAfter?: Date): Promise<readonly CatalogAppRecord[]> {
    const rows = await this.sql<CatalogRow[]>`
      select
        a.id as app_id,
        a.app_mint,
        a.slug,
        a.package_name,
        a.name as app_name,
        a.short_description,
        a.description,
        a.icon_uri,
        a.screenshots,
        coalesce(
          nullif(a.source_snapshot #>> '{appMetadata,properties,category}', ''),
          nullif(r.source_snapshot #>> '{releaseMetadata,properties,category}', '')
        ) as source_category,
        a.claim_status,
        a.authority_address,
        a.distribution_enabled,
        consent.status as consent_status,
        consent.environment as consent_environment,
        r.id as release_id,
        r.release_mint,
        r.version_name,
        r.version_code::text,
        r.certificate_sha256,
        r.apk_uri,
        r.apk_size::text,
        r.apk_sha256,
        r.min_sdk,
        r.target_sdk,
        r.permissions,
        r.validation_status,
        r.publication_status,
        approval.status as approval_status
        , r.updated_at as release_updated_at
      from hub.apps a
      join hub.releases r on r.app_id = a.id
      join lateral (
        select dc.status, dc.environment
        from hub.distribution_consents dc
        where dc.app_id = a.id
          and dc.environment = ${environment}::hub.app_environment
          and dc.status = 'active'
          and dc.superseded_at is null
        order by dc.verified_at desc
        limit 1
      ) consent on true
      left join lateral (
        select ra.status
        from hub.release_approvals ra
        where ra.release_id = r.id and ra.superseded_at is null
        order by ra.created_at desc
        limit 1
      ) approval on true
      where a.claim_status = 'verified'
        and a.distribution_enabled = true
        and a.revoked_at is null
        and a.suspended_at is null
        and (${changedAfter ?? null}::timestamptz is null or r.updated_at > ${changedAfter ?? null})
        and (${query ?? null}::text is null or a.search_document @@ plainto_tsquery('simple', ${query ?? null}))
      order by a.name asc, r.version_code desc
    `;

    return rows.map(mapCatalogRow);
  }
}

function mapCatalogRow(row: CatalogRow): CatalogAppRecord {
  return {
    id: row.app_id,
    appMint: row.app_mint,
    slug: row.slug,
    packageName: row.package_name,
    name: row.app_name,
    shortDescription: row.short_description,
    description: row.description,
    iconUri: row.icon_uri,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots.filter((value): value is string => typeof value === "string") : [],
    category: normalizeCatalogCategory(row.source_category),
    eligibility: {
      appMint: row.app_mint,
      claimStatus: row.claim_status,
      authorityCurrent: row.authority_address !== null,
      consentStatus: row.consent_status,
      consentEnvironment: row.consent_environment,
      distributionEnabled: row.distribution_enabled
    },
    release: {
      id: row.release_id,
      releaseMint: row.release_mint,
      appMint: row.app_mint,
      packageName: row.package_name,
      versionName: row.version_name,
      versionCode: BigInt(row.version_code),
      certificateSha256: row.certificate_sha256,
      permissions: row.permissions,
      validationStatus: row.validation_status,
      publicationStatus: row.publication_status,
      approvalStatus: row.approval_status ?? "unknown"
    },
    binary: {
      apkUri: row.apk_uri,
      apkSize: Number(row.apk_size),
      apkSha256: row.apk_sha256,
      minSdk: row.min_sdk,
      targetSdk: row.target_sdk
    },
    releaseUpdatedAt: row.release_updated_at
  };
}
