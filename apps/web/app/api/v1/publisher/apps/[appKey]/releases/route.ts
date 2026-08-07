import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { listPublisherReleases } from "@/server/publisher-operations-service";
import { getCurrentSession } from "@/server/session-service";

export async function GET(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const session = await getCurrentSession();
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A publisher session is required.");
  const { appKey } = await context.params;
  const releases = await listPublisherReleases(session, appKey);
  return NextResponse.json({ releases, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
