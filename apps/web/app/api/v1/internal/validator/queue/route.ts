import { ValidationRepository } from "@hub/database";
import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { authenticateOperationsGithubActions } from "@/server/operations-github-oidc";
import { database, hubConfig } from "@/server/runtime";

const repository = new ValidationRepository(database);

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (hubConfig.appEnvironment !== "production") {
    return apiError(404, "VALIDATOR_QUEUE_UNAVAILABLE", id, "This deployment does not use the validator queue.");
  }
  const identity = await authenticateOperationsGithubActions(request, {
    workflowFile: "dispatch-apks.yml", audience: "dapport-apk-dispatcher"
  });
  if (!identity) return apiError(401, "DISPATCHER_IDENTITY_REJECTED", id, "GitHub Actions identity was rejected.");
  try {
    const runIds = await repository.reserveQueuedBinaryRuns();
    return NextResponse.json({ runIds }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(503, "VALIDATOR_QUEUE_UNAVAILABLE", id, "Could not reserve queued validations.");
  }
}
