import { describe, expect, it } from "vitest";
import { ReleaseRepository, type HubSql } from "../src/index.js";

function harness() {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const tag = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  }, { json: (value: unknown) => value });
  const sql = Object.assign(tag, { begin: (operation: (tx: typeof tag) => unknown) => Promise.resolve(operation(tag)) }) as unknown as HubSql;
  return { repository: new ReleaseRepository(sql), calls };
}
const job = { id: "job", appId: "app", leaseOwner: "lease" };

describe("durable sync job outcomes", () => {
  it("persists useful partial results as failed with retry backoff and preserves last success", async () => {
    const { repository, calls } = harness();
    const result = { officialApproval: { status: "verified", versionCode: "11" }, validationFailures: [{ code: "DISPATCH_FAILED" }] };
    await repository.completeSyncJob(job, result, 123n, ["VALIDATION_DISPATCH:DISPATCH_FAILED"]);
    const jobUpdate = calls.find((call) => call.text.includes("update hub.sync_jobs"))!;
    expect(jobUpdate.text).toContain("status = 'failed'");
    expect(jobUpdate.text).toContain("lease_owner = ? and status = 'running'");
    expect(jobUpdate.text).toContain("result = case when ? then ? else result end");
    expect(jobUpdate.values).toContain("SYNC_INCOMPLETE");
    expect(jobUpdate.values).toContainEqual(result);
    expect(jobUpdate.values).toContain(true);
    const state = calls.find((call) => call.text.includes("insert into hub.sync_state"))!;
    expect(state.text).toContain("hub.sync_state.consecutive_failures + 1");
    expect(state.text).toContain("least(interval '1 hour'");
    expect(state.text).not.toContain("last_success_at");
    expect(state.text).not.toContain("last_finalized_slot");
    expect(calls.some((call) => call.text.includes("status = 'succeeded'"))).toBe(false);
  });

  it("records a complete success and resets failure backoff only when there are no issues", async () => {
    const { repository, calls } = harness();
    await repository.completeSyncJob(job, { issues: [] }, 123n);
    expect(calls[0]?.text).toContain("status = 'succeeded'");
    expect(calls[0]?.values).toContainEqual({ issues: [] });
    const state = calls[1]!;
    expect(state.text).toContain("last_success_at = now()");
    expect(state.text).toContain("consecutive_failures = 0");
    expect(state.values).toContain("123");
  });

  it("preserves an existing result when a failure supplies no replacement", async () => {
    const { repository, calls } = harness();
    await repository.failSyncJob(job, "PROVIDER_TIMEOUT", "Unavailable");
    expect(calls[0]?.text).toContain("result = case when ? then ? else result end");
    expect(calls[0]?.values).toContain(false);
  });
});
