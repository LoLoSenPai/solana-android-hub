import { generateKeyPairSync } from "node:crypto";
import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BinaryValidationManifest, BinaryValidationResult } from "@hub/database";
import type { HubConfig } from "@hub/config";

const repository = vi.hoisted(() => ({
  createBinaryRun: vi.fn<(releaseId: string, publisherId: string) => Promise<{ manifest: BinaryValidationManifest; created: boolean }>>(),
  failToSchedule: vi.fn<(runId: string, detail: string) => Promise<void>>(),
  getManifest: vi.fn<(runId: string) => Promise<BinaryValidationManifest | null>>(),
  getStoredManifest: vi.fn<(runId: string) => Promise<BinaryValidationManifest | null>>(),
  completeBinaryRun: vi.fn<(input: { resultAccepted: boolean }) => Promise<"succeeded" | "failed">>()
}));
vi.mock("@hub/database", () => ({ ValidationRepository: class { constructor() { return repository; } } }));
const config = vi.hoisted((): Pick<HubConfig, "appEnvironment" | "githubRepository" | "githubActionsToken" | "githubValidatorRef" | "hubOrigin"> => ({
  appEnvironment: "production", githubRepository: "owner/hub",
  githubValidatorRef: "main", hubOrigin: "https://hub.example.com"
}));
vi.mock("../server/runtime", () => ({ database: {}, hubConfig: config }));

import { recordBinaryValidationResult, requestBinaryValidation } from "../server/validation-service";
import { wakeApkDispatcher } from "../server/github-app-dispatch";

const manifest: BinaryValidationManifest = {
  runId: "run-id", apkUrl: "https://cdn.example.com/app.apk", expectedSize: 123,
  expectedSha256: "a".repeat(64), packageName: "app.example", versionCode: "12",
  certificateSha256: "b".repeat(64), minSdk: 26, permissions: ["permission.one", "permission.two"]
};
const matchingResult: BinaryValidationResult = {
  status: "succeeded", failureCodes: [], observed: {
    byteSize: 123, sha256: manifest.expectedSha256, packageName: "app.example", versionCode: "12",
    certificateSha256: manifest.certificateSha256, minSdk: 26, permissions: [...manifest.permissions]
  }
};
const identity = { runId: manifest.runId, oidcSubject: "github-subject", oidcReplayKeyHash: "replay-hash" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GITHUB_APP_ID", undefined);
  vi.stubEnv("GITHUB_APP_INSTALLATION_ID", undefined);
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", undefined);
  config.appEnvironment = "production";
  delete config.githubActionsToken;
  repository.getStoredManifest.mockResolvedValue(manifest);
  repository.completeBinaryRun.mockResolvedValue("succeeded");
  repository.createBinaryRun.mockResolvedValue({ manifest, created: true });
  repository.failToSchedule.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recordBinaryValidationResult", () => {
  it("reads stored immutable expectations without mutating run state and accepts exact observations", async () => {
    await expect(recordBinaryValidationResult({ ...identity, result: matchingResult })).resolves.toBe("succeeded");
    expect(repository.getStoredManifest).toHaveBeenCalledWith(manifest.runId);
    expect(repository.getManifest).not.toHaveBeenCalled();
    expect(repository.completeBinaryRun).toHaveBeenCalledWith({
      ...identity, result: matchingResult, environment: "production", resultAccepted: true
    });
  });

  it.each([
    ["byteSize", 124], ["sha256", "c".repeat(64)], ["packageName", "app.other"],
    ["versionCode", "13"], ["certificateSha256", "c".repeat(64)], ["minSdk", 27],
    ["permissions", ["permission.one"]], ["permissions", ["permission.one", "permission.two", "extra"]],
    ["permissions", ["permission.one", 2]], ["byteSize", "123"]
  ])("rejects mismatched %s observations", async (field, value) => {
    const result = { ...matchingResult, observed: { ...matchingResult.observed, [field]: value } };
    await recordBinaryValidationResult({ ...identity, result });
    expect(repository.completeBinaryRun.mock.calls[0]?.[0].resultAccepted).toBe(false);
  });

  it("accepts equivalent digests, version types and permission sets", async () => {
    const result = { ...matchingResult, observed: {
      ...matchingResult.observed, sha256: manifest.expectedSha256.toUpperCase().match(/../g)?.join(":"),
      certificateSha256: manifest.certificateSha256.toUpperCase(), versionCode: 12,
      permissions: ["permission.two", "permission.one", "permission.one"]
    } };
    await recordBinaryValidationResult({ ...identity, result });
    expect(repository.completeBinaryRun.mock.calls[0]?.[0].resultAccepted).toBe(true);
  });

  it.each([
    { ...matchingResult, status: "failed" as const },
    { ...matchingResult, failureCodes: ["VALIDATOR_RUNNER_FAILED"] },
    { status: "succeeded" as const, failureCodes: [] }
  ])("rejects unsuccessful, flagged or absent observations", async (result) => {
    await recordBinaryValidationResult({ ...identity, result });
    expect(repository.completeBinaryRun.mock.calls[0]?.[0].resultAccepted).toBe(false);
  });

  it("lets the repository enforce old-run rejection", async () => {
    repository.completeBinaryRun.mockRejectedValue(new Error("VALIDATION_RESULT_REPLAYED"));
    await expect(recordBinaryValidationResult({ ...identity, result: matchingResult })).rejects.toThrow("VALIDATION_RESULT_REPLAYED");
    expect(repository.getManifest).not.toHaveBeenCalled();
  });

  it("passes a duplicate callback with completed expectations through to repository idempotency", async () => {
    await recordBinaryValidationResult({ ...identity, result: matchingResult });
    await recordBinaryValidationResult({ ...identity, result: matchingResult });
    expect(repository.getStoredManifest).toHaveBeenCalledTimes(2);
    expect(repository.completeBinaryRun).toHaveBeenCalledTimes(2);
    expect(repository.getManifest).not.toHaveBeenCalled();
  });

  it("does not complete an unavailable run", async () => {
    repository.getStoredManifest.mockResolvedValue(null);
    await expect(recordBinaryValidationResult({ ...identity, result: matchingResult })).rejects.toThrow("VALIDATION_RUN_NOT_FOUND_OR_COMPLETED");
    expect(repository.completeBinaryRun).not.toHaveBeenCalled();
  });
});

describe("requestBinaryValidation", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  function configureGithubApp() {
    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "456");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey.export({ type: "pkcs1", format: "pem" }).toString().replaceAll("\n", "\\n"));
  }

  it("queues production work without a long-lived dispatch credential", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).resolves.toEqual({ status: "validating_binary", runId: manifest.runId });
    expect(repository.createBinaryRun).toHaveBeenCalledWith("release", "publisher");
    expect(fetch).not.toHaveBeenCalled();
    expect(repository.failToSchedule).not.toHaveBeenCalled();
  });
  it.each([200, 204])("wakes the shared dispatcher after queueing with a scoped installation token (HTTP %s)", async (status) => {
    configureGithubApp();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ token: "installation-token" }, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).resolves.toEqual({
      status: "validating_binary", runId: manifest.runId
    });
    expect(repository.createBinaryRun).toHaveBeenCalledBefore(fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenRequest] = fetch.mock.calls[0]!;
    expect(tokenUrl).toBe("https://api.github.com/app/installations/456/access_tokens");
    expect(JSON.parse(tokenRequest?.body as string)).toEqual({ repositories: ["hub"], permissions: { actions: "write" } });
    const jwt = new Headers(tokenRequest?.headers).get("authorization")?.replace(/^Bearer /u, "");
    const { payload } = await jwtVerify(jwt!, publicKey, { algorithms: ["RS256"], issuer: "123" });
    const now = Math.floor(Date.now() / 1000);
    expect(payload.iat).toBeLessThan(now);
    expect(payload.exp).toBeLessThanOrEqual(now + 600);
    const [dispatchUrl, dispatchRequest] = fetch.mock.calls[1]!;
    expect(dispatchUrl).toBe("https://api.github.com/repos/owner/hub/actions/workflows/dispatch-apks.yml/dispatches");
    expect(new Headers(dispatchRequest?.headers).get("authorization")).toBe("Bearer installation-token");
    expect(JSON.parse(dispatchRequest?.body as string)).toEqual({ ref: "main", inputs: { correlation_id: manifest.runId } });
    expect(repository.failToSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ["partial configuration", 0], ["invalid key", 0],
    ["token denied", 1], ["token missing", 1],
    ["dispatch denied", 2], ["dispatch timed out", 2]
  ] as const)(
    "keeps production work available for the cron after %s", async (failure, expectedCalls) => {
      configureGithubApp();
      const fetch = vi.fn<typeof globalThis.fetch>();
      if (failure === "partial configuration") vi.stubEnv("GITHUB_APP_INSTALLATION_ID", undefined);
      if (failure === "invalid key") vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "private-value");
      if (failure === "token denied") fetch.mockResolvedValueOnce(new Response("private-value", { status: 401 }));
      if (failure === "token missing") fetch.mockResolvedValueOnce(Response.json({}, { status: 201 }));
      if (failure.startsWith("dispatch")) {
        fetch.mockResolvedValueOnce(Response.json({ token: "private-value" }, { status: 201 }));
        if (failure === "dispatch denied") fetch.mockResolvedValueOnce(new Response("private-value", { status: 403 }));
        else fetch.mockRejectedValueOnce(new Error("private-value"));
      }
      vi.stubGlobal("fetch", fetch);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).resolves.toEqual({
        status: "validating_binary", runId: manifest.runId
      });
      expect(repository.failToSchedule).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(expectedCalls);
      expect(warn).toHaveBeenCalledOnce();
      expect(JSON.stringify(warn.mock.calls)).not.toContain("private-value");
    }
  );

  it("reports operator wake-up acceptance and supports the original multiline PEM", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ token: "installation-token" }, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(wakeApkDispatcher("owner/hub", "operation")).resolves.toBe(false);
    configureGithubApp();
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey.export({ type: "pkcs1", format: "pem" }).toString());
    await expect(wakeApkDispatcher("owner/hub", "operation")).resolves.toBe(true);
    expect(JSON.parse(fetch.mock.calls[1]?.[1]?.body as string)).toEqual({ ref: "main", inputs: { correlation_id: "operation" } });
    await expect(wakeApkDispatcher("owner/hub", "operation")).resolves.toBe(false);
    expect(repository.createBinaryRun).not.toHaveBeenCalled();
  });

  it("does not redispatch an active fresh run", async () => {
    configureGithubApp();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    repository.createBinaryRun.mockResolvedValue({ manifest, created: false });
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).resolves.toEqual({ status: "validating_binary", runId: manifest.runId });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([200, 204])("accepts a successful staging dispatch (%s) with the configured ref and origin", async (status) => {
    config.appEnvironment = "staging";
    config.githubActionsToken = "test-token";
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);
    await requestBinaryValidation({ publisherId: "publisher" }, "release");
    expect(repository.createBinaryRun).toHaveBeenCalledWith("release", "publisher");
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.github.com/repos/owner/hub/actions/workflows/apk-validator.yml/dispatches");
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ ref: "main", inputs: { correlation_id: manifest.runId, hub_origin: "https://hub.example.com" } });
    expect(repository.failToSchedule).not.toHaveBeenCalled();
  });

  it("marks unsuccessful staging dispatch responses as failed to schedule", async () => {
    config.appEnvironment = "staging";
    config.githubActionsToken = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503 }));
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).rejects.toThrow("VALIDATOR_DISPATCH_HTTP_503");
    expect(repository.failToSchedule).toHaveBeenCalledWith(manifest.runId, "VALIDATOR_DISPATCH_HTTP_503");
  });

  it("marks transport errors as failed to schedule and preserves their cause", async () => {
    config.appEnvironment = "staging";
    config.githubActionsToken = "test-token";
    const error = new Error("transport failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).rejects.toBe(error);
    expect(repository.failToSchedule).toHaveBeenCalledWith(manifest.runId, "transport failed");
  });
});
