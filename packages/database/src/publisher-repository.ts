import type { AppEnvironment, ReleasePolicy } from "@hub/domain";
import type { AuthorityProofEvidence } from "@hub/solana";
import type { HubSql } from "./client";
import type { ChallengeRecord } from "./auth-repository";

export interface PublisherAppRecord {
  id: string;
  publisherId: string;
  appMint: string;
  publisherMint: string;
  packageName: string;
  metadataUri: string;
  claimStatus: "pending" | "verified" | "suspended" | "revoked";
}

interface AppRow {
  id: string;
  publisher_id: string;
  app_mint: string;
  publisher_mint: string;
  package_name: string;
  metadata_uri: string;
  claim_status: PublisherAppRecord["claimStatus"];
}

export class PublisherRepository {
  public constructor(private readonly sql: HubSql) {}

  public async getAppForPublisher(appId: string, publisherId: string): Promise<PublisherAppRecord | null> {
    const [row] = await this.sql<AppRow[]>`
      select id, publisher_id, app_mint, publisher_mint, package_name, metadata_uri, claim_status
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
        select id, publisher_id, app_mint, publisher_mint, package_name, metadata_uri, claim_status
        from hub.apps where app_mint = ${input.proof.appMint} for update
      `;
      if (existing && existing.publisher_id !== input.publisherId) throw new Error("APP_ALREADY_CLAIMED");

      const [app] = await tx<AppRow[]>`
        insert into hub.apps (
          publisher_id, app_mint, publisher_mint, package_name, slug, name, short_description, description,
          icon_uri, screenshots, metadata_uri, source_snapshot, source_snapshot_hash, claim_status,
          authority_path, authority_address, authority_last_verified_slot, authority_last_verified_at
        ) values (
          ${input.publisherId}, ${input.proof.appMint}, ${input.proof.publisherMint}, ${input.packageName}, ${input.slug},
          ${input.name}, ${input.shortDescription}, ${input.description}, ${input.iconUri}, ${this.sql.json([...input.screenshots])},
          ${input.metadataUri}, ${input.sourceSnapshotJson}::jsonb, ${input.sourceSnapshotHash}, 'verified',
          ${input.proof.path === "metadata_update_authority" ? "update_authority" : "delegated_collection_authority"},
          ${input.proof.wallet}, ${input.proof.finalizedSlot.toString()}, now()
        )
        on conflict (app_mint) do update set
          publisher_mint = excluded.publisher_mint,
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
        returning id, publisher_id, app_mint, publisher_mint, package_name, metadata_uri, claim_status
      `;
      if (!app) throw new Error("APP_CLAIM_NOT_SAVED");
      await tx`update hub.app_claims set superseded_at = now() where app_id = ${app.id} and superseded_at is null`;
      await tx`
        insert into hub.app_claims (
          app_id, publisher_wallet_id, status, authority_path, finalized_slot, evidence_hash, evidence_snapshot, verified_at
        ) values (
          ${app.id}, ${input.publisherWalletId}, 'verified',
          ${input.proof.path === "metadata_update_authority" ? "update_authority" : "delegated_collection_authority"},
          ${input.proof.finalizedSlot.toString()}, ${input.evidenceHash}, ${evidenceSnapshotJson}::jsonb, now()
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
        update hub.apps set release_policy = ${input.releasePolicy}, distribution_enabled = true, updated_at = now()
        where id = ${input.app.id}
      `;
      return consent.id;
    });
  }
}

function mapApp(row: AppRow): PublisherAppRecord {
  return {
    id: row.id,
    publisherId: row.publisher_id,
    appMint: row.app_mint,
    publisherMint: row.publisher_mint,
    packageName: row.package_name,
    metadataUri: row.metadata_uri,
    claimStatus: row.claim_status
  };
}
