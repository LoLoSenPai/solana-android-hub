import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/v1/internal/validator/queue/route";

const mocks = vi.hoisted(() => ({
  config: { appEnvironment: "production" }, authenticate: vi.fn(), reserve: vi.fn()
}));
vi.mock("@/server/http", async () => import("../server/http"));
vi.mock("@/server/runtime", () => ({ database: {}, hubConfig: mocks.config }));
vi.mock("@/server/operations-github-oidc", () => ({ authenticateOperationsGithubActions: mocks.authenticate }));
vi.mock("@hub/database", () => ({ ValidationRepository: class { reserveQueuedBinaryRuns = mocks.reserve; } }));

const request = new Request("https://dapport.app/api/v1/internal/validator/queue", { method: "POST" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.appEnvironment = "production";
});

describe("production validator queue", () => {
  it("requires the dedicated dispatcher identity before reserving runs", async () => {
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.authenticate).toHaveBeenCalledWith(request, {
      workflowFile: "dispatch-apks.yml", audience: "dapport-apk-dispatcher"
    });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("is disabled outside production", async () => {
    mocks.config.appEnvironment = "staging";
    expect((await POST(request)).status).toBe(404);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("returns only the reserved correlation IDs with no caching", async () => {
    const runIds = ["a05d62ae-6f3c-4eee-aed0-9122e99378b7"];
    mocks.authenticate.mockResolvedValue({ runId: "123" });
    mocks.reserve.mockResolvedValue(runIds);
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ runIds });
  });

  it("reports a reservation error distinctly from an empty queue", async () => {
    mocks.authenticate.mockResolvedValue({ runId: "123" });
    mocks.reserve.mockRejectedValue(new Error("database failure"));
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
