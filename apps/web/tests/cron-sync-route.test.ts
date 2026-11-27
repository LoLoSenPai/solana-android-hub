import type { HubConfig } from "@hub/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/v1/internal/cron/sync/route";

const mocks = vi.hoisted(() => {
  const config: Pick<HubConfig, "appEnvironment" | "cronSecret" | "githubRepository" | "heliusApiKey"> = {
    appEnvironment: "production",
    cronSecret: "cron-test-secret"
  };
  return { config, sync: vi.fn(), wake: vi.fn() };
});
vi.mock("@/server/github-app-dispatch", () => ({ wakeApkDispatcher: mocks.wake }));
vi.mock("@/server/http", async () => import("../server/http"));
vi.mock("@/server/release-sync-service", () => ({ syncDuePublisherApps: mocks.sync }));
vi.mock("@/server/runtime", () => ({ hubConfig: mocks.config }));

const id = "d2d3b706-aa5d-449f-9917-6821b7b02eff";
const repository = "LoLoSenPai/solana-android-hub";
const wakeOptions = '{"operation":"wake_apk_dispatcher"}';

function request(body: string, authorized = true) {
  return new Request("https://hub.example/api/v1/internal/cron/sync", {
    method: "POST", body,
    headers: authorized ? {
      authorization: "Bearer cron-test-secret", "content-type": "application/json", "x-request-id": id
    } : {}
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.appEnvironment = "production";
  mocks.config.githubRepository = repository;
  mocks.config.heliusApiKey = "helius-test";
  mocks.sync.mockResolvedValue([{ appId: "app", status: "completed" }]);
  mocks.wake.mockResolvedValue(true);
});

describe("authenticated cron sync", () => {
  it("rejects an unauthenticated forced run before synchronization", async () => {
    expect((await POST(request('{"force":true}', false))).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it.each([
    '{"force":"true"}', '{"force":true,"unexpected":true}', '{"operation":"other"}',
    '{"operation":"wake_apk_dispatcher","force":false}', '{"operation":"wake_apk_dispatcher","extra":true}',
    "[]", "null", "not-json", "x".repeat(1025)
  ])("rejects invalid options without starting synchronization: %s", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SYNC_OPTIONS" } });
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.wake).not.toHaveBeenCalled();
  });

  it("passes the authenticated force option and reports completed results", async () => {
    const response = await POST(request('{"force":true}'));
    expect(mocks.sync).toHaveBeenCalledWith(20, true);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ attempted: 1, incomplete: 0, results: [{ status: "completed" }] });
    expect(mocks.wake).not.toHaveBeenCalled();
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
    expect(mocks.wake).not.toHaveBeenCalled();
  });
});

describe("operational APK dispatcher wake-up", () => {
  it("rejects unauthenticated requests before calling GitHub", async () => {
    const response = await POST(request(wakeOptions, false));
    expect(response.status).toBe(401);
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("reports acceptance by GitHub with the request ID, without Helius or synchronization", async () => {
    delete mocks.config.heliusApiKey;
    const response = await POST(request(wakeOptions));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(await response.json()).toEqual({ status: "accepted", requestId: id });
    expect(mocks.wake).toHaveBeenCalledExactlyOnceWith(repository, id);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects wake-ups outside production", async () => {
    mocks.config.appEnvironment = "staging";
    expect((await POST(request(wakeOptions))).status).toBe(503);
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects wake-ups without a configured repository", async () => {
    delete mocks.config.githubRepository;
    expect((await POST(request(wakeOptions))).status).toBe(503);
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("reports a failed wake-up as unavailable", async () => {
    mocks.wake.mockResolvedValue(false);
    const response = await POST(request(wakeOptions));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(await response.json()).toMatchObject({ requestId: id, error: { code: "APK_DISPATCHER_UNAVAILABLE" } });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("keeps unexpected dispatch errors out of the response", async () => {
    mocks.wake.mockRejectedValue(new Error("internal GitHub error"));
    const response = await POST(request(wakeOptions));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal GitHub error");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
