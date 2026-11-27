import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/v1/internal/cron/sync/route";

const mocks = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("@/server/http", async () => import("../server/http"));
vi.mock("@/server/release-sync-service", () => ({ syncDuePublisherApps: mocks.sync }));
vi.mock("@/server/runtime", () => ({ hubConfig: { cronSecret: "cron-test-secret", heliusApiKey: "helius-test" } }));

function request(body: string, authorized = true) {
  return new Request("https://hub.example/api/v1/internal/cron/sync", {
    method: "POST", body,
    headers: authorized ? { authorization: "Bearer cron-test-secret", "content-type": "application/json" } : {}
  });
}
beforeEach(() => { vi.resetAllMocks(); mocks.sync.mockResolvedValue([{ appId: "app", status: "completed" }]); });

describe("authenticated cron sync", () => {
  it("rejects an unauthenticated forced run before synchronization", async () => {
    expect((await POST(request('{"force":true}', false))).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it.each(['{"force":"true"}', '{"force":true,"unexpected":true}', "[]", "null", "not-json", "x".repeat(1025)])("rejects invalid options without starting synchronization: %s", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SYNC_OPTIONS" } });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("passes the authenticated force option and reports completed results", async () => {
    const response = await POST(request('{"force":true}'));
    expect(mocks.sync).toHaveBeenCalledWith(20, true);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ attempted: 1, incomplete: 0, results: [{ status: "completed" }] });
  });

  it.each(["partial", "failed"])("reports %s jobs as incomplete with HTTP 503", async (status) => {
    mocks.sync.mockResolvedValue([{ appId: "app", status, issues: ["PROVIDER_TIMEOUT"] }]);
    const response = await POST(request("{}"));
    expect(response.status).toBe(503);
    expect(mocks.sync).toHaveBeenCalledWith(20, false);
    expect(await response.json()).toMatchObject({ attempted: 1, incomplete: 1, results: [{ status, issues: ["PROVIDER_TIMEOUT"] }] });
  });

  it("keeps scheduled GET runs unforced", async () => {
    const response = await GET(new Request("https://hub.example/api/v1/internal/cron/sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(20, false);
  });
});
