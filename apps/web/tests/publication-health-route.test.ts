import type { HubConfig } from "@hub/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/v1/internal/cron/publication-health/route";

const mocks = vi.hoisted(() => {
  const hubConfig: Pick<HubConfig, "appEnvironment" | "githubRepository"> = { appEnvironment: "production" };
  return { authenticate: vi.fn(), read: vi.fn(), wake: vi.fn(), hubConfig };
});
vi.mock("@/server/github-app-dispatch", () => ({ wakeApkDispatcher: mocks.wake }));
vi.mock("@/server/http", async () => import("../server/http"));
vi.mock("@/server/operations-github-oidc", () => ({ authenticateOperationsGithubActions: mocks.authenticate }));
vi.mock("@/server/runtime", () => ({ hubConfig: mocks.hubConfig, database: {} }));
vi.mock("@hub/database", () => ({ PublicationHealthRepository: class { read = mocks.read; } }));

const request = new Request("https://dapport.app/api/v1/internal/cron/publication-health");
const issue = { app: "qa", code: "VALIDATOR_DISPATCH_HTTP_401", version: "3", validationId: "123" };
const githubRepository = "LoLoSenPai/solana-android-hub";
const id = "d2d3b706-aa5d-449f-9917-6821b7b02eff";
const dispatchRequest = new Request(request.url, { method: "POST", headers: { "x-request-id": id } });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hubConfig.appEnvironment = "production";
  mocks.hubConfig.githubRepository = githubRepository;
  mocks.authenticate.mockResolvedValue({ subject: "repo:example/repo:ref:refs/heads/main", runId: "123", runAttempt: "1" });
  mocks.read.mockResolvedValue({ issues: [], truncated: false });
  mocks.wake.mockResolvedValue(true);
});

describe("publication health route", () => {
  it("requires its dedicated identity before accessing the repository", async () => {
    mocks.authenticate.mockResolvedValue(null);
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.authenticate).toHaveBeenCalledWith(request, {
      workflowFile: "publication-health.yml", audience: "dapport-publication-health"
    });
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("fails closed on a non-production environment", async () => {
    mocks.hubConfig.appEnvironment = "staging";
    const response = await GET(request);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "PUBLICATION_MONITOR_WRONG_ENVIRONMENT" } });
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("reports a healthy snapshot without caching", async () => {
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ issues: [], truncated: false, requestId: response.headers.get("x-request-id") });
    expect(mocks.read).toHaveBeenCalledWith("production");
    expect(mocks.wake).not.toHaveBeenCalled();
  });

  it("returns a failing status with the persisted diagnostic", async () => {
    mocks.read.mockResolvedValue({ issues: [issue], truncated: false });
    const response = await GET(request);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ issues: [issue], truncated: false });
  });

  it("reports a database outage without leaking its error string", async () => {
    mocks.read.mockRejectedValue(new Error("private data"));
    const response = await GET(request);
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("PUBLICATION_MONITOR_READ_FAILED");
    expect(body).not.toContain("private data");
  });
});

describe("manual APK dispatcher check", () => {
  it("requires the dedicated manual workflow identity before calling GitHub", async () => {
    mocks.authenticate.mockResolvedValue(null);
    const response = await POST(dispatchRequest);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { code: "APK_DISPATCH_CHECK_AUTH_REJECTED" }, requestId: id });
    expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(dispatchRequest, {
      workflowFile: "publication-health.yml", audience: "dapport-apk-dispatch-check", manualOnly: true
    });
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("reports acceptance by GitHub with the request ID without reading publication health", async () => {
    const response = await POST(dispatchRequest);
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(await response.json()).toEqual({ status: "accepted", requestId: id });
    expect(mocks.wake).toHaveBeenCalledExactlyOnceWith(githubRepository, id);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("rejects wake-ups outside production or without a configured repository", async () => {
    mocks.hubConfig.appEnvironment = "staging";
    expect((await POST(dispatchRequest)).status).toBe(503);
    mocks.hubConfig.appEnvironment = "production";
    delete mocks.hubConfig.githubRepository;
    expect((await POST(dispatchRequest)).status).toBe(503);
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("reports failed wake-ups as unavailable", async () => {
    mocks.wake.mockResolvedValue(false);
    const response = await POST(dispatchRequest);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(await response.json()).toMatchObject({ requestId: id, error: { code: "APK_DISPATCHER_UNAVAILABLE" } });
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("keeps unexpected dispatch errors out of the response", async () => {
    mocks.wake.mockRejectedValue(new Error("private data"));
    const response = await POST(dispatchRequest);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private data");
  });
});
