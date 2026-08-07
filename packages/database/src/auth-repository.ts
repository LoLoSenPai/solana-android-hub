import type { AppEnvironment } from "@hub/domain";
import type { HubSql } from "./client";

export interface ChallengeRecord {
  id: string;
  walletAddress: string;
  message: string;
  purpose: "authentication" | "distribution_consent";
  environment: AppEnvironment;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionRecord {
  id: string;
  publisherId: string;
  publisherWalletId: string;
  walletAddress: string;
  csrfHash: Buffer;
  absoluteExpiresAt: Date;
}

interface ChallengeRow {
  id: string;
  wallet_address: string;
  message: string;
  purpose: ChallengeRecord["purpose"];
  environment: AppEnvironment;
  created_at: Date;
  expires_at: Date;
  attempts: number;
  consumed_at: Date | null;
}

export class AuthRepository {
  public constructor(private readonly sql: HubSql) {}

  public async createChallenge(input: {
    walletAddress: string;
    purpose: ChallengeRecord["purpose"];
    environment: AppEnvironment;
    nonceHash: Buffer;
    message: string;
    expiresAt: Date;
  }): Promise<ChallengeRecord> {
    const [row] = await this.sql<ChallengeRow[]>`
      insert into hub.auth_challenges (wallet_address, purpose, environment, nonce_hash, message, expires_at)
      values (${input.walletAddress}, ${input.purpose}, ${input.environment}, ${input.nonceHash}, ${input.message}, ${input.expiresAt})
      returning id, wallet_address, message, purpose, environment, created_at, expires_at, attempts, consumed_at
    `;
    if (!row) throw new Error("CHALLENGE_NOT_CREATED");
    return mapChallenge(row);
  }

  public async authenticate(input: {
    challengeId: string;
    expectedEnvironment: AppEnvironment;
    tokenHash: Buffer;
    csrfHash: Buffer;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    verify: (wallet: string, message: string) => boolean;
  }): Promise<SessionRecord | null> {
    return this.sql.begin(async (tx) => {
      const [challenge] = await tx<ChallengeRow[]>`
        select id, wallet_address, message, purpose, environment, created_at, expires_at, attempts, consumed_at
        from hub.auth_challenges where id = ${input.challengeId} for update
      `;
      if (!challenge || challenge.purpose !== "authentication" || challenge.environment !== input.expectedEnvironment ||
        challenge.consumed_at !== null || challenge.expires_at <= new Date() || challenge.attempts >= 5) return null;

      await tx`update hub.auth_challenges set attempts = attempts + 1 where id = ${challenge.id}`;
      if (!input.verify(challenge.wallet_address, challenge.message)) return null;
      await tx`update hub.auth_challenges set consumed_at = now() where id = ${challenge.id}`;
      await tx`select pg_advisory_xact_lock(hashtext(${challenge.wallet_address}))`;

      let [wallet] = await tx<{ id: string; publisher_id: string }[]>`
        select id, publisher_id from hub.publisher_wallets where wallet_address = ${challenge.wallet_address}
      `;
      if (!wallet) {
        const [publisher] = await tx<{ id: string }[]>`insert into hub.publishers default values returning id`;
        if (!publisher) throw new Error("PUBLISHER_NOT_CREATED");
        [wallet] = await tx<{ id: string; publisher_id: string }[]>`
          insert into hub.publisher_wallets (publisher_id, wallet_address, last_authenticated_at)
          values (${publisher.id}, ${challenge.wallet_address}, now())
          returning id, publisher_id
        `;
      } else {
        await tx`update hub.publisher_wallets set last_authenticated_at = now() where id = ${wallet.id}`;
      }
      if (!wallet) throw new Error("PUBLISHER_WALLET_NOT_CREATED");

      const [session] = await tx<{ id: string; absolute_expires_at: Date }[]>`
        insert into hub.sessions (publisher_wallet_id, token_hash, csrf_hash, idle_expires_at, absolute_expires_at)
        values (${wallet.id}, ${input.tokenHash}, ${input.csrfHash}, ${input.idleExpiresAt}, ${input.absoluteExpiresAt})
        returning id, absolute_expires_at
      `;
      if (!session) throw new Error("SESSION_NOT_CREATED");
      return {
        id: session.id,
        publisherId: wallet.publisher_id,
        publisherWalletId: wallet.id,
        walletAddress: challenge.wallet_address,
        csrfHash: input.csrfHash,
        absoluteExpiresAt: session.absolute_expires_at
      };
    });
  }

  public async getSession(tokenHash: Buffer): Promise<SessionRecord | null> {
    const [row] = await this.sql<{
      id: string;
      publisher_id: string;
      publisher_wallet_id: string;
      wallet_address: string;
      csrf_hash: Buffer;
      absolute_expires_at: Date;
    }[]>`
      update hub.sessions s
      set last_seen_at = now(),
          idle_expires_at = least(now() + interval '24 hours', s.absolute_expires_at)
      from hub.publisher_wallets pw
      where s.publisher_wallet_id = pw.id
        and s.token_hash = ${tokenHash}
        and s.revoked_at is null
        and s.idle_expires_at > now()
        and s.absolute_expires_at > now()
      returning s.id, pw.publisher_id, s.publisher_wallet_id, pw.wallet_address, s.csrf_hash, s.absolute_expires_at
    `;
    return row ? {
      id: row.id,
      publisherId: row.publisher_id,
      publisherWalletId: row.publisher_wallet_id,
      walletAddress: row.wallet_address,
      csrfHash: row.csrf_hash,
      absoluteExpiresAt: row.absolute_expires_at
    } : null;
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await this.sql`update hub.sessions set revoked_at = coalesce(revoked_at, now()) where id = ${sessionId}`;
  }
}

function mapChallenge(row: ChallengeRow): ChallengeRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    message: row.message,
    purpose: row.purpose,
    environment: row.environment,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}
