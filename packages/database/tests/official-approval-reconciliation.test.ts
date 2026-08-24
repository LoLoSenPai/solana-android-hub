import { describe, expect, it } from "vitest";
import { ReleaseRepository, type HubSql } from "../src/index.js";

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

describe("official Solana Mobile approval reconciliation", () => {
  it("approves only the unique release matching the consented app package and official version", async () => {
    const harness = sqlHarness((call) => {
      if (call.text.includes("select package_name from hub.apps")) return [{ package_name: "com.example.game" }];
      if (call.text.includes("select approval.release_id")) return [];
      if (call.text.includes("select id from hub.releases")) return [{ id: "release-v2" }];
      return [];
    });
    const repository = new ReleaseRepository(harness.sql);

    await expect(repository.reconcileOfficialStoreApproval({
      appId: "app-id",
      packageName: "com.example.game",
      versionCode: 2n,
      sourceReference: "https://dappstore.solanamobile.com/graphql",
      evidence: { androidPackage: "com.example.game", versionCode: "2" }
    })).resolves.toBe("verified");

    const statements = harness.calls.map((call) => call.text).join("\n");
    expect(statements).toContain("package_name = ?");
    expect(statements).toContain("version_code = ?");
    expect(statements).toContain("'official_provider'");
    expect(statements).toContain("'verified_approved'");
  });

  it("removes stale official evidence when the package is no longer visible without marking it rejected", async () => {
    const harness = sqlHarness((call) => {
      if (call.text.includes("select package_name from hub.apps")) return [{ package_name: "com.example.game" }];
      if (call.text.includes("select approval.release_id")) return [{ release_id: "release-v1" }];
      return [];
    });
    const repository = new ReleaseRepository(harness.sql);

    await expect(repository.reconcileOfficialStoreApproval({
      appId: "app-id",
      packageName: "com.example.game",
      versionCode: null,
      sourceReference: "https://dappstore.solanamobile.com/graphql",
      evidence: { androidPackage: "com.example.game", versionCode: null }
    })).resolves.toBe("not_visible");

    const statements = harness.calls.map((call) => call.text).join("\n");
    expect(statements).toContain("set superseded_at = now()");
    expect(statements).not.toContain("'rejected'");
  });
});
