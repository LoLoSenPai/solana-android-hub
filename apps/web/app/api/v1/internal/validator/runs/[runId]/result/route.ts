import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGithubActions } from "@/server/github-oidc";
import { apiError, requestId } from "@/server/http";
import { recordBinaryValidationResult } from "@/server/validation-service";

const resultSchema = z.object({
  runId: z.uuid(),
  status: z.enum(["succeeded", "failed"]),
  observed: z.record(z.string(), z.unknown()).optional(),
  failureCodes: z.array(z.string().regex(/^[A-Z0-9_]+$/u)).max(20),
  toolVersions: z.record(z.string(), z.unknown()).optional(),
  logDigest: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
  detail: z.string().max(500).optional()
}).strict();

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const identity = await authenticateGithubActions(request);
  if (!identity) return apiError(401, "VALIDATOR_IDENTITY_REJECTED", id, "GitHub Actions identity was rejected.");
  const { runId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success || parsed.data.runId !== runId) return apiError(400, "VALIDATOR_RESULT_INVALID", id, "Validation result is invalid.");
  try {
    const status = await recordBinaryValidationResult({
      runId,
      result: {
        status: parsed.data.status,
        failureCodes: parsed.data.failureCodes,
        ...(parsed.data.observed ? { observed: parsed.data.observed } : {}),
        ...(parsed.data.toolVersions ? { toolVersions: parsed.data.toolVersions } : {}),
        ...(parsed.data.logDigest ? { logDigest: parsed.data.logDigest } : {})
      },
      oidcSubject: identity.subject,
      oidcReplayKeyHash: identity.replayKeyHash
    });
    return NextResponse.json({ status, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch (error) {
    if (error instanceof Error && /REPLAYED|COMPLETED/u.test(error.message)) {
      return apiError(409, "VALIDATOR_RESULT_REPLAYED", id, "Validation result has already been consumed.");
    }
    return apiError(404, "VALIDATION_RUN_NOT_FOUND", id, "Validation run is unavailable.");
  }
}
