import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { syncPublisherApp } from "@/server/release-sync-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const requestIdentifier = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", requestIdentifier, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", requestIdentifier, "A valid session and CSRF token are required.");
  const { appKey: id } = await context.params;
  try {
    const result = await syncPublisherApp(session, id);
    return NextResponse.json({ ...result, requestId: requestIdentifier }, { headers: { "cache-control": "no-store", "x-request-id": requestIdentifier } });
  } catch {
    return apiError(503, "RELEASE_SYNC_FAILED", requestIdentifier, "Finalized release synchronization failed.");
  }
}
