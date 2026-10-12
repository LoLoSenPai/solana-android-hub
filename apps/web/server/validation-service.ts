import { ValidationRepository, type BinaryValidationManifest, type BinaryValidationResult, type SessionRecord } from "@hub/database";
import { database, hubConfig } from "./runtime";

const repository = new ValidationRepository(database);

export async function requestBinaryValidation(session: Pick<SessionRecord, "publisherId">, releaseId: string) {
  if (hubConfig.appEnvironment === "local" && !hubConfig.githubRepository) {
    throw new Error("VALIDATOR_NOT_CONFIGURED");
  }
  if (!hubConfig.githubRepository || !hubConfig.githubActionsToken) throw new Error("VALIDATOR_NOT_CONFIGURED");
  const request = await repository.createBinaryRun(releaseId, session.publisherId);
  const { manifest } = request;
  if (!request.created) return { status: "validating_binary" as const, runId: manifest.runId };
  try {
    await dispatchValidation(manifest);
  } catch (error) {
    await repository.failToSchedule(manifest.runId, error instanceof Error ? error.message : "GitHub dispatch failed");
    throw error;
  }
  return { status: "validating_binary" as const, runId: manifest.runId };
}

export async function getBinaryValidationManifest(runId: string): Promise<BinaryValidationManifest | null> {
  return repository.getManifest(runId);
}

export async function recordBinaryValidationResult(input: {
  runId: string;
  result: BinaryValidationResult;
  oidcSubject: string;
  oidcReplayKeyHash: string;
}) {
  const manifest = await repository.getStoredManifest(input.runId);
  if (!manifest) throw new Error("VALIDATION_RUN_NOT_FOUND_OR_COMPLETED");
  return repository.completeBinaryRun({
    ...input,
    environment: hubConfig.appEnvironment,
    resultAccepted: resultMatchesManifest(manifest, input.result)
  });
}

export async function expireStaleBinaryValidations(): Promise<number> {
  return repository.expireStaleBinaryRuns();
}

export async function publishValidatedRelease(session: SessionRecord, releaseId: string) {
  return repository.publishValidatedRelease(releaseId, session.publisherId, hubConfig.appEnvironment);
}

function resultMatchesManifest(manifest: BinaryValidationManifest, result: BinaryValidationResult): boolean {
  if (result.status !== "succeeded" || result.failureCodes.length !== 0 || !result.observed) return false;
  const observed = result.observed;
  return observed.byteSize === manifest.expectedSize
    && normalize(observed.sha256) === manifest.expectedSha256
    && observed.packageName === manifest.packageName
    && String(observed.versionCode) === manifest.versionCode
    && observed.minSdk === manifest.minSdk
    && normalize(observed.certificateSha256) === manifest.certificateSha256
    && equalStrings(observed.permissions, manifest.permissions);
}

function equalStrings(value: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return false;
  return JSON.stringify([...new Set(value)].sort()) === JSON.stringify([...expected].sort());
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.replaceAll(":", "").trim().toLowerCase() : "";
}

async function dispatchValidation(manifest: BinaryValidationManifest): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${hubConfig.githubRepository}/actions/workflows/apk-validator.yml/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${hubConfig.githubActionsToken}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify({
      ref: hubConfig.githubValidatorRef,
      inputs: { correlation_id: manifest.runId, hub_origin: hubConfig.hubOrigin }
    }),
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status !== 204) throw new Error(`VALIDATOR_DISPATCH_HTTP_${response.status}`);
}
