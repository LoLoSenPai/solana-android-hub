import {
  normalizeCatalogCategory,
  normalizeGameGenres,
  type AppEligibility,
  type AppEnvironment,
  type ApprovalStatus,
  type CatalogCategory,
  type GameGenre,
  type PublisherLinks,
  type ReleaseCandidate
} from "@hub/domain";
import type { HubSql } from "./client";

export interface CatalogAppRecord {
  id: string;
  publisher?: { id: string; slug: string; displayName: string | null } | null;
  appMint: string;
  slug: string;
  packageName: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  iconUri: string | null;
  screenshots: readonly string[];
  bannerUri: string | null;
  featureGraphicUri: string | null;
  category: CatalogCategory;
  genres: readonly GameGenre[];
  publisherLinks: PublisherLinks;
  solanaMobileRating: {
    averageRating: number;
    reviewsByRating: readonly [number, number, number, number, number];
  } | null;
  solanaMobileStore: {
    status: "visible" | "not_visible";
    versionCode: string | null;
    checkedAt: string;
    sourceReference: "https://dappstore.solanamobile.com/graphql#explore";
  } | null;
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
  publisher_id: string;
  publisher_slug: string;
  publisher_display_name: string | null;
  app_mint: string;
  slug: string;
  package_name: string;
  app_name: string;
  short_description: string | null;
  description: string | null;
  icon_uri: string | null;
  screenshots: unknown;
  banner_uri: string | null;
  feature_graphic_uri: string | null;
  source_category: string | null;
  hub_category: string | null;
  hub_tags: unknown;
  publisher_links: unknown;
  official_average_rating: number | null;
  official_reviews_by_rating: unknown;
  official_store_checks: unknown;
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

  public async listReleaseCandidates(environment: AppEnvironment, query?: string, changedAfter?: Date, publisherId?: string): Promise<readonly CatalogAppRecord[]> {
    const rows = await this.sql<CatalogRow[]>`
      select
        a.id as app_id,
        p.id as publisher_id,
        coalesce(p.profile_slug, p.id::text) as publisher_slug,
        p.display_name as publisher_display_name,
        a.app_mint,
        a.slug,
        a.package_name,
        a.name as app_name,
        a.short_description,
        a.description,
        coalesce(r.icon_uri, a.icon_uri) as icon_uri,
        case when jsonb_array_length(r.screenshots) > 0 then r.screenshots else a.screenshots end as screenshots,
        r.banner_uri,
        r.feature_graphic_uri,
        classification.primary_category as hub_category,
        classification.tags as hub_tags,
        coalesce(publisher_links.links, '{}'::jsonb) as publisher_links,
        (store_rating.rating #>> '{averageRating}')::double precision as official_average_rating,
        store_rating.rating #> '{reviewsByRating}' as official_reviews_by_rating,
        store_presence.checks as official_store_checks,
        coalesce(
          nullif(r.source_snapshot #>> '{releaseMetadata,properties,category}', ''),
          nullif(a.source_snapshot #>> '{appMetadata,properties,category}', '')
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
      join hub.publishers p on p.id = a.publisher_id and p.status = 'active'
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
        where ra.release_id = r.id
          and ra.source = 'official_provider'
          and ra.superseded_at is null
        order by ra.created_at desc
        limit 1
      ) approval on true
      left join hub.app_classifications classification on classification.app_id = a.id
      left join lateral (
        select job.result #> '{officialRating}' as rating
        from hub.sync_jobs job
        where job.app_id = a.id
          and job.status in ('succeeded', 'failed')
          and job.result #>> '{officialRating,status}' = 'available'
        order by job.completed_at desc
        limit 1
      ) store_rating on true
      left join lateral (
        select jsonb_agg(history.check_result order by history.completed_at desc, history.created_at desc, history.id desc) as checks
        from (
          select job.id, job.completed_at, job.created_at, job.result #> '{officialApproval}' as check_result
          from hub.sync_jobs job
          where job.app_id = a.id
            and job.status in ('succeeded', 'failed')
            and job.result #>> '{officialApproval,androidPackage}' = a.package_name
            and job.result #>> '{officialApproval,sourceReference}' = 'https://dappstore.solanamobile.com/graphql#explore'
            and job.result #>> '{officialApproval,status}' in ('verified', 'release_not_found', 'not_visible')
          order by job.completed_at desc, job.created_at desc, job.id desc
          limit 32
        ) history
      ) store_presence on true
      left join lateral (
        select jsonb_object_agg(link.link_type::text, link.url) as links
        from hub.app_publisher_links link
        where link.app_id = a.id
      ) publisher_links on true
      where a.claim_status = 'verified'
        and a.distribution_enabled = true
        and a.revoked_at is null
        and a.suspended_at is null
        and (${publisherId ?? null}::uuid is null or a.publisher_id = ${publisherId ?? null}::uuid)
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
    publisher: row.publisher_id ? { id: row.publisher_id, slug: row.publisher_slug, displayName: row.publisher_display_name } : null,
    appMint: row.app_mint,
    slug: row.slug,
    packageName: row.package_name,
    name: row.app_name,
    shortDescription: row.short_description,
    description: row.description,
    iconUri: row.icon_uri,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots.filter((value): value is string => typeof value === "string") : [],
    bannerUri: row.banner_uri,
    featureGraphicUri: row.feature_graphic_uri,
    category: normalizeCatalogCategory(row.hub_category ?? row.source_category),
    genres: normalizeGameGenres(row.hub_tags),
    publisherLinks: mapPublisherLinks(row.publisher_links),
    solanaMobileRating: mapOfficialRating(row.official_average_rating, row.official_reviews_by_rating),
    solanaMobileStore: mapOfficialStorePresence(row.official_store_checks, row.package_name),
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

function mapPublisherLinks(value: unknown): PublisherLinks {
  const links = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const link = (type: keyof PublisherLinks) => typeof links[type] === "string" ? links[type] : null;
  return { website: link("website"), x: link("x"), discord: link("discord"), telegram: link("telegram") };
}

function mapOfficialStorePresence(value: unknown, packageName: string): CatalogAppRecord["solanaMobileStore"] {
  if (!Array.isArray(value)) return null;
  for (const candidate of value) {
    if (candidate === null || typeof candidate !== "object") continue;
    const check = candidate as Record<string, unknown>;
    if (check.androidPackage !== packageName || check.sourceReference !== "https://dappstore.solanamobile.com/graphql#explore") continue;
    if (!["verified", "release_not_found", "not_visible"].includes(String(check.status))) continue;
    if (typeof check.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(check.checkedAt)
        || !Number.isFinite(Date.parse(check.checkedAt))
        || new Date(check.checkedAt).toISOString().slice(0, 19) !== check.checkedAt.slice(0, 19)) continue;
    if (check.versionCode !== null && (typeof check.versionCode !== "string" || !/^[1-9]\d*$/.test(check.versionCode))) continue;
    if ((check.status === "not_visible") !== (check.versionCode === null)) continue;
    return {
      status: check.status === "not_visible" ? "not_visible" : "visible",
      versionCode: check.versionCode,
      checkedAt: check.checkedAt,
      sourceReference: check.sourceReference
    };
  }
  return null;
}

function mapOfficialRating(averageRating: number | null, value: unknown): CatalogAppRecord["solanaMobileRating"] {
  if (averageRating === null || !Number.isFinite(averageRating) || averageRating < 0 || averageRating > 5) return null;
  if (!Array.isArray(value) || value.length !== 5) return null;
  const reviewsByRating = value.map(Number);
  if (reviewsByRating.some((count) => !Number.isInteger(count) || count < 0)) return null;
  if (reviewsByRating.reduce((total, count) => total + count, 0) === 0) return null;
  return {
    averageRating,
    reviewsByRating: [
      reviewsByRating[0]!,
      reviewsByRating[1]!,
      reviewsByRating[2]!,
      reviewsByRating[3]!,
      reviewsByRating[4]!
    ]
  };
}
