import { NextResponse } from "next/server";
import { authenticateGithubActions } from "@/server/github-oidc";
import { apiError, requestId } from "@/server/http";
import { getBinaryValidationManifest } from "@/server/validation-service";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const identity = await authenticateGithubActions(request);
  if (!identity) return apiError(401, "VALIDATOR_IDENTITY_REJECTED", id, "GitHub Actions identity was rejected.");
  const { runId } = await context.params;
  const manifest = await getBinaryValidationManifest(runId);
  if (!manifest) return apiError(404, "VALIDATION_RUN_NOT_FOUND", id, "Validation run is unavailable.");
  return NextResponse.json(manifest, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
