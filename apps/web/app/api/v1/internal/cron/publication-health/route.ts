import { PublicationHealthRepository } from "@hub/database";
import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { authenticateOperationsGithubActions } from "@/server/operations-github-oidc";
import { database, hubConfig } from "@/server/runtime";

const repository = new PublicationHealthRepository(database);

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const identity = await authenticateOperationsGithubActions(request, {
    workflowFile: "publication-health.yml", audience: "dapport-publication-health"
  });
  if (!identity) return apiError(401, "PUBLICATION_MONITOR_AUTH_REJECTED", id, "Publication monitor authentication was rejected.");
  if (hubConfig.appEnvironment !== "production") {
    return apiError(503, "PUBLICATION_MONITOR_WRONG_ENVIRONMENT", id, "The monitor requires the production Hub.");
  }
  try {
    const health = await repository.read(hubConfig.appEnvironment);
    return NextResponse.json({ ...health, requestId: id }, {
      status: health.issues.length ? 503 : 200,
      headers: { "cache-control": "no-store", "x-request-id": id }
    });
  } catch {
    return apiError(503, "PUBLICATION_MONITOR_READ_FAILED", id, "Publication health could not be read.");
  }
}
