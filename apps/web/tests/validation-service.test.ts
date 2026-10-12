import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BinaryValidationManifest, BinaryValidationResult } from "@hub/database";

const repository = vi.hoisted(() => ({
  createBinaryRun: vi.fn<(releaseId: string, publisherId: string) => Promise<{ manifest: BinaryValidationManifest; created: boolean }>>(),
  failToSchedule: vi.fn<(runId: string, detail: string) => Promise<void>>(),
  getManifest: vi.fn<(runId: string) => Promise<BinaryValidationManifest | null>>(),
  getStoredManifest: vi.fn<(runId: string) => Promise<BinaryValidationManifest | null>>(),
  completeBinaryRun: vi.fn<(input: { resultAccepted: boolean }) => Promise<"succeeded" | "failed">>()
}));
vi.mock("@hub/database", () => ({ ValidationRepository: class { constructor() { return repository; } } }));
vi.mock("../server/runtime", () => ({
  database: {},
  hubConfig: {
    appEnvironment: "production", githubRepository: "owner/hub", githubActionsToken: "test-token",
    githubValidatorRef: "main", hubOrigin: "https://hub.example.com"
  }
}));

import { recordBinaryValidationResult, requestBinaryValidation } from "../server/validation-service";

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
  repository.getStoredManifest.mockResolvedValue(manifest);
  repository.completeBinaryRun.mockResolvedValue("succeeded");
  repository.createBinaryRun.mockResolvedValue({ manifest, created: true });
  repository.failToSchedule.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

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
  it("does not redispatch an active fresh run", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    repository.createBinaryRun.mockResolvedValue({ manifest, created: false });
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).resolves.toEqual({ status: "validating_binary", runId: manifest.runId });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dispatches a new correlation with the configured ref and origin", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await requestBinaryValidation({ publisherId: "publisher" }, "release");
    expect(repository.createBinaryRun).toHaveBeenCalledWith("release", "publisher");
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.github.com/repos/owner/hub/actions/workflows/apk-validator.yml/dispatches");
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ ref: "main", inputs: { correlation_id: manifest.runId, hub_origin: "https://hub.example.com" } });
    expect(repository.failToSchedule).not.toHaveBeenCalled();
  });

  it("marks non-204 dispatch responses as failed to schedule", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503 }));
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).rejects.toThrow("VALIDATOR_DISPATCH_HTTP_503");
    expect(repository.failToSchedule).toHaveBeenCalledWith(manifest.runId, "VALIDATOR_DISPATCH_HTTP_503");
  });

  it("marks transport errors as failed to schedule and preserves their cause", async () => {
    const error = new Error("transport failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(requestBinaryValidation({ publisherId: "publisher" }, "release")).rejects.toBe(error);
    expect(repository.failToSchedule).toHaveBeenCalledWith(manifest.runId, "transport failed");
  });
});
