import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { revokePublisherDistribution } from "@/server/publisher-operations-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const { appKey } = await context.params;
  const revoked = await revokePublisherDistribution(session, appKey);
  if (!revoked) return apiError(404, "PUBLISHER_APP_NOT_FOUND", id, "Publisher App was not found.");
  return NextResponse.json({ status: "revoked", requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
