import { PUBLISHER_LINK_TYPES, type AppEnvironment, type CatalogCategory, type GameGenre, type PublisherLinks, type ReleasePolicy } from "@hub/domain";
import type { AuthorityProofEvidence } from "@hub/solana";
import type { HubSql } from "./client";
import { parseJsonValue } from "./json";
import type { ChallengeRecord } from "./auth-repository";

export interface PublisherAppRecord {
  id: string;
  publisherId: string;
  appMint: string;
  publisherCollectionMint: string | null;
  packageName: string;
  metadataUri: string;
  claimStatus: "pending" | "verified" | "suspended" | "revoked";
  releasePolicy: ReleasePolicy;
  distributionEnabled: boolean;
}

interface AppRow {
  id: string;
  publisher_id: string;
  app_mint: string;
  publisher_collection_mint: string | null;
  package_name: string;
  metadata_uri: string;
  claim_status: PublisherAppRecord["claimStatus"];
  release_policy: ReleasePolicy;
  distribution_enabled: boolean;
}

export class PublisherRepository {
  public constructor(private readonly sql: HubSql) {}

  public async getAppForPublisher(appId: string, publisherId: string): Promise<PublisherAppRecord | null> {
    const [row] = await this.sql<AppRow[]>`
      select id, publisher_id, app_mint, publisher_collection_mint, package_name, metadata_uri, claim_status, release_policy, distribution_enabled
      from hub.apps where id = ${appId} and publisher_id = ${publisherId}
    `;
    return row ? mapApp(row) : null;
  }

  public async saveVerifiedClaim(input: {
    publisherId: string;
    publisherWalletId: string;
    proof: AuthorityProofEvidence;
    packageName: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    description: string | null;
    iconUri: string | null;
    screenshots: readonly string[];
    metadataUri: string;
    sourceSnapshotJson: string;
    sourceSnapshotHash: string;
    evidenceHash: string;
  }): Promise<PublisherAppRecord> {
    const evidenceSnapshotJson = JSON.stringify({
      ...input.proof,
      finalizedSlot: input.proof.finalizedSlot.toString()
    });
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${input.proof.appMint}))`;
      const [existing] = await tx<AppRow[]>`
        select id, publisher_id, app_mint, publisher_collection_mint, package_name, metadata_uri, claim_status, release_policy, distribution_enabled
        from hub.apps where app_mint = ${input.proof.appMint} for update
      `;
      if (existing && existing.publisher_id !== input.publisherId) throw new Error("APP_ALREADY_CLAIMED");

      const [app] = await tx<AppRow[]>`
        insert into hub.apps (
          publisher_id, app_mint, publisher_collection_mint, package_name, slug, name, short_description, description,
          icon_uri, screenshots, metadata_uri, source_snapshot, source_snapshot_hash, claim_status,
          authority_path, authority_address, authority_last_verified_slot, authority_last_verified_at
        ) values (
          ${input.publisherId}, ${input.proof.appMint}, ${input.proof.publisherCollectionMint}, ${input.packageName}, ${input.slug},
          ${input.name}, ${input.shortDescription}, ${input.description}, ${input.iconUri}, ${this.sql.json([...input.screenshots])},
          ${input.metadataUri}, ${tx.json(parseJsonValue(input.sourceSnapshotJson))}, ${input.sourceSnapshotHash}, 'verified',
          ${input.proof.path === "metadata_update_authority" ? "update_authority" : "delegated_collection_authority"},
          ${input.proof.wallet}, ${input.proof.finalizedSlot.toString()}, now()
        )
        on conflict (app_mint) do update set
          publisher_collection_mint = excluded.publisher_collection_mint,
          package_name = excluded.package_name,
          name = excluded.name,
          short_description = excluded.short_description,
          description = excluded.description,
          icon_uri = excluded.icon_uri,
          screenshots = excluded.screenshots,
          metadata_uri = excluded.metadata_uri,
          source_snapshot = excluded.source_snapshot,
          source_snapshot_hash = excluded.source_snapshot_hash,
          claim_status = 'verified',
          authority_path = excluded.authority_path,
          authority_address = excluded.authority_address,
          authority_last_verified_slot = excluded.authority_last_verified_slot,
          authority_last_verified_at = now(),
          updated_at = now()
        returning id, publisher_id, app_mint, publisher_collection_mint, package_name, metadata_uri, claim_status, release_policy, distribution_enabled
      `;
      if (!app) throw new Error("APP_CLAIM_NOT_SAVED");
      await tx`update hub.app_claims set superseded_at = now() where app_id = ${app.id} and superseded_at is null`;
      await tx`
        insert into hub.app_claims (
          app_id, publisher_wallet_id, status, authority_path, finalized_slot, evidence_hash, evidence_snapshot, verified_at
        ) values (
          ${app.id}, ${input.publisherWalletId}, 'verified',
          ${input.proof.path === "metadata_update_authority" ? "update_authority" : "delegated_collection_authority"},
          ${input.proof.finalizedSlot.toString()}, ${input.evidenceHash}, ${tx.json(parseJsonValue(evidenceSnapshotJson))}, now()
        )
      `;
      return mapApp(app);
    });
  }

  public async recordConsent(input: {
    app: PublisherAppRecord;
    publisherWalletId: string;
    walletAddress: string;
    challengeId: string;
    environment: AppEnvironment;
    signature: string;
    releasePolicy: ReleasePolicy;
    termsVersion: string;
    scopes: readonly string[];
    verify: (wallet: string, message: string) => boolean;
  }): Promise<string | null> {
    return this.sql.begin(async (tx) => {
      const [appState] = await tx<{ was_revoked: boolean }[]>`
        select revoked_at is not null as was_revoked
        from hub.apps where id = ${input.app.id} and publisher_id = ${input.app.publisherId} for update
      `;
      if (!appState) return null;
      const [challenge] = await tx<{
        id: string;
        wallet_address: string;
        message: string;
        purpose: ChallengeRecord["purpose"];
        environment: AppEnvironment;
        created_at: Date;
        expires_at: Date;
        attempts: number;
        consumed_at: Date | null;
        nonce_hash: Buffer;
      }[]>`
        select id, wallet_address, message, purpose, environment, created_at, expires_at, attempts, consumed_at, nonce_hash
        from hub.auth_challenges where id = ${input.challengeId} for update
      `;
      if (!challenge || challenge.purpose !== "distribution_consent" || challenge.environment !== input.environment ||
        challenge.wallet_address !== input.walletAddress || challenge.consumed_at !== null || challenge.expires_at <= new Date() || challenge.attempts >= 5) return null;
      await tx`update hub.auth_challenges set attempts = attempts + 1 where id = ${challenge.id}`;
      if (!input.verify(challenge.wallet_address, challenge.message)) return null;
      await tx`update hub.auth_challenges set consumed_at = now() where id = ${challenge.id}`;
      await tx`
        update hub.distribution_consents set status = 'superseded', superseded_at = now()
        where app_id = ${input.app.id} and environment = ${input.environment} and status = 'active'
      `;
      const [consent] = await tx<{ id: string }[]>`
        insert into hub.distribution_consents (
          app_id, publisher_wallet_id, environment, message, signature, nonce_hash, scopes, release_policy,
          terms_version, issued_at, signing_expires_at, verified_at
        ) values (
          ${input.app.id}, ${input.publisherWalletId}, ${input.environment}, ${challenge.message}, ${input.signature},
          ${challenge.nonce_hash}, ${input.scopes}, ${input.releasePolicy}, ${input.termsVersion}, ${challenge.created_at},
          ${challenge.expires_at}, now()
        ) returning id
      `;
      if (!consent) throw new Error("CONSENT_NOT_SAVED");
      await tx`
        update hub.apps set release_policy = ${input.releasePolicy}, distribution_enabled = true,
          revoked_at = null, updated_at = now()
        where id = ${input.app.id}
      `;
      if (appState.was_revoked) {
        await tx`
          update hub.releases r set
            publication_status = case
              when r.validation_status = 'server_binary_valid' and ${input.releasePolicy} = 'automatic'
                then 'published'::hub.publication_status
              when ${input.environment} <> 'production' and r.validation_status in ('metadata_valid', 'server_binary_valid')
                then 'preview'::hub.publication_status
              else 'unpublished'::hub.publication_status
            end,
            published_at = case
              when r.validation_status = 'server_binary_valid' and ${input.releasePolicy} = 'automatic'
                then coalesce(r.published_at, now())
              else r.published_at
            end,
            updated_at = now()
          from hub.apps a
          where r.app_id = ${input.app.id} and r.app_id = a.id
            and r.publication_status = 'withdrawn' and r.quarantine_code is null
            and a.claim_status = 'verified' and a.suspended_at is null
        `;
      }
      return consent.id;
    });
  }

  public async saveClassification(input: {
    appId: string;
    publisherId: string;
    walletAddress: string;
    category: CatalogCategory;
    genres: readonly GameGenre[];
  }): Promise<boolean> {
    const [classification] = await this.sql<{ app_id: string }[]>`
      insert into hub.app_classifications (app_id, primary_category, tags, source, updated_by_wallet)
      select id, ${input.category}, ${input.genres}, 'publisher', ${input.walletAddress}
      from hub.apps
      where id = ${input.appId} and publisher_id = ${input.publisherId} and claim_status = 'verified'
      on conflict (app_id) do update set
        primary_category = excluded.primary_category,
        tags = excluded.tags,
        source = excluded.source,
        updated_by_wallet = excluded.updated_by_wallet,
        updated_at = now()
      returning app_id
    `;
    return Boolean(classification);
  }

  public async savePublisherLinks(input: {
    appId: string;
    publisherId: string;
    walletAddress: string;
    links: PublisherLinks;
  }): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      const [app] = await tx<{ id: string }[]>`
        select id from hub.apps
        where id = ${input.appId} and publisher_id = ${input.publisherId} and claim_status = 'verified'
        for update
      `;
      if (!app) return false;
      const [current] = await tx<{ links: unknown }[]>`
        select coalesce(jsonb_object_agg(link_type::text, url), '{}'::jsonb) as links
        from hub.app_publisher_links where app_id = ${input.appId}
      `;
      await tx`delete from hub.app_publisher_links where app_id = ${input.appId}`;
      for (const linkType of PUBLISHER_LINK_TYPES) {
        const url = input.links[linkType];
        if (url === null) continue;
        await tx`
          insert into hub.app_publisher_links (app_id, link_type, url, updated_by_wallet)
          values (${input.appId}, ${linkType}::hub.publisher_link_type, ${url}, ${input.walletAddress})
        `;
      }
      await tx`
        insert into hub.app_publisher_link_audit (app_id, actor_wallet, previous_links, next_links)
        values (
          ${input.appId}, ${input.walletAddress},
          ${tx.json(parseJsonValue(JSON.stringify(current?.links && typeof current.links === "object" ? current.links : {})))},
          ${tx.json(parseJsonValue(JSON.stringify(Object.fromEntries(PUBLISHER_LINK_TYPES.flatMap((type) => input.links[type] ? [[type, input.links[type]]] : [])))))}
        )
      `;
      return true;
    });
  }
}

function mapApp(row: AppRow): PublisherAppRecord {
  return {
    id: row.id,
    publisherId: row.publisher_id,
    appMint: row.app_mint,
    publisherCollectionMint: row.publisher_collection_mint,
    packageName: row.package_name,
    metadataUri: row.metadata_uri,
    claimStatus: row.claim_status,
    releasePolicy: row.release_policy,
    distributionEnabled: row.distribution_enabled
  };
}
