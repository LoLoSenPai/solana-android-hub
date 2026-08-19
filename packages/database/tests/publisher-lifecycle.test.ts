import { describe, expect, it } from "vitest";
import { PublisherOperationsRepository, PublisherRepository, type HubSql } from "../src/index.js";

interface SqlCall {
  text: string;
  values: readonly unknown[];
}

function sqlHarness(respond: (call: SqlCall) => unknown): { sql: HubSql; calls: SqlCall[] } {
  const calls: SqlCall[] = [];
  const baseTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const call = { text: strings.join("?"), values };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  const tag = Object.assign(baseTag, { json: (value: unknown) => value });
  const sql = Object.assign(tag, {
    begin: (operation: (transaction: typeof tag) => unknown) => Promise.resolve(operation(tag))
  }) as unknown as HubSql;
  return { sql, calls };
}

describe("publisher removal lifecycle", () => {
  it("revokes distribution without collecting a publisher-facing reason", async () => {
    const harness = sqlHarness((call) => call.text.includes("select id from hub.apps") ? [{ id: "app-id" }] : []);
    const repository = new PublisherOperationsRepository(harness.sql);

    await expect(repository.revokeDistribution("app-id", "publisher-id", "production")).resolves.toBe(true);

    const statements = harness.calls.map((call) => call.text).join("\n");
    expect(statements).toContain("revocation_reason = null");
    expect(statements).toContain("publication_status = 'withdrawn'");
  });

  it("restores a publisher-revoked app when a new consent is signed", async () => {
    const harness = sqlHarness((call) => {
      if (call.text.includes("select revoked_at is not null")) return [{ was_revoked: true }];
      if (call.text.includes("from hub.auth_challenges")) return [{
        id: "challenge-id",
        wallet_address: "wallet",
        message: "canonical consent",
        purpose: "distribution_consent",
        environment: "production",
        created_at: new Date("2026-08-11T10:00:00.000Z"),
        expires_at: new Date("2099-08-11T10:10:00.000Z"),
        attempts: 0,
        consumed_at: null,
        nonce_hash: Buffer.alloc(32)
      }];
      if (call.text.includes("insert into hub.distribution_consents")) return [{ id: "new-consent-id" }];
      return [];
    });
    const repository = new PublisherRepository(harness.sql);

    await expect(repository.recordConsent(consentInput())).resolves.toBe("new-consent-id");

    const statements = harness.calls.map((call) => call.text).join("\n");
    expect(statements).toContain("revoked_at = null");
    expect(statements).toContain("publication_status = case");
    expect(statements).toContain("publication_status = 'withdrawn'");
  });

  it("does not revive unrelated withdrawn releases for an app that was not publisher-revoked", async () => {
    const harness = sqlHarness((call) => {
      if (call.text.includes("select revoked_at is not null")) return [{ was_revoked: false }];
      if (call.text.includes("from hub.auth_challenges")) return [{
        id: "challenge-id",
        wallet_address: "wallet",
        message: "canonical consent",
        purpose: "distribution_consent",
        environment: "production",
        created_at: new Date("2026-08-11T10:00:00.000Z"),
        expires_at: new Date("2099-08-11T10:10:00.000Z"),
        attempts: 0,
        consumed_at: null,
        nonce_hash: Buffer.alloc(32)
      }];
      if (call.text.includes("insert into hub.distribution_consents")) return [{ id: "new-consent-id" }];
      return [];
    });
    const repository = new PublisherRepository(harness.sql);

    await expect(repository.recordConsent(consentInput())).resolves.toBe("new-consent-id");

    expect(harness.calls.some((call) => call.text.includes("publication_status = case"))).toBe(false);
  });
});

describe("publisher storefront links", () => {
  it("replaces all links atomically and records an append-only snapshot", async () => {
    const harness = sqlHarness((call) => {
      if (call.text.includes("select id from hub.apps")) return [{ id: "app-id" }];
      if (call.text.includes("jsonb_object_agg")) return [{ links: { website: "https://old.example/" } }];
      return [];
    });
    const repository = new PublisherRepository(harness.sql);
    const saved = await repository.savePublisherLinks({
      appId: "app-id",
      publisherId: "publisher-id",
      walletAddress: "D2FDh5vdxdnnTXaZcHjF3sqoAKt5xTxACgRSVqfZbdrw",
      links: { website: "https://new.example/", x: "https://x.com/example", discord: null, telegram: null }
    });

    expect(saved).toBe(true);
    const statements = harness.calls.map((call) => call.text).join("\n");
    expect(statements).toContain("for update");
    expect(statements).toContain("delete from hub.app_publisher_links");
    expect(statements.match(/insert into hub\.app_publisher_links/gu)).toHaveLength(2);
    expect(statements).toContain("insert into hub.app_publisher_link_audit");
  });
});

function consentInput() {
  return {
    app: {
      id: "app-id",
      publisherId: "publisher-id",
      appMint: "app-mint",
      publisherCollectionMint: null,
      packageName: "com.example.app",
      metadataUri: "https://example.com/app.json",
      claimStatus: "verified" as const
    },
    publisherWalletId: "publisher-wallet-id",
    walletAddress: "wallet",
    challengeId: "challenge-id",
    environment: "production" as const,
    signature: "signature",
    releasePolicy: "automatic" as const,
    termsVersion: "terms-v1",
    scopes: ["list_app"],
    verify: () => true
  };
}
