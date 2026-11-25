import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/v1/internal/cron/publication-health/route";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), read: vi.fn(), hubConfig: { appEnvironment: "production" } }));
vi.mock("@/server/http", async () => import("../server/http"));
vi.mock("@/server/operations-github-oidc", () => ({ authenticateOperationsGithubActions: mocks.authenticate }));
vi.mock("@/server/runtime", () => ({ hubConfig: mocks.hubConfig, database: {} }));
vi.mock("@hub/database", () => ({ PublicationHealthRepository: class { read = mocks.read; } }));

const request = new Request("https://dapport.app/api/v1/internal/cron/publication-health");
const issue = { app: "qa", code: "VALIDATOR_DISPATCH_HTTP_401", version: "3", validationId: "123" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hubConfig.appEnvironment = "production";
  mocks.authenticate.mockResolvedValue({ subject: "repo:example/repo:ref:refs/heads/main", runId: "123", runAttempt: "1" });
  mocks.read.mockResolvedValue({ issues: [], truncated: false });
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
