import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { revokePublisherDistribution } from "@/server/publisher-operations-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const schema = z.object({ reason: z.string().trim().min(4).max(1000) }).strict();

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "REVOCATION_REASON_INVALID", id, "A revocation reason is required.");
  const { appKey } = await context.params;
  const revoked = await revokePublisherDistribution(session, appKey, parsed.data.reason);
  if (!revoked) return apiError(404, "PUBLISHER_APP_NOT_FOUND", id, "Publisher App was not found.");
  return NextResponse.json({ status: "revoked", requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
