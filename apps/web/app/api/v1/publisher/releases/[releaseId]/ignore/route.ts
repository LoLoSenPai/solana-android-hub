import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { ignorePublisherRelease } from "@/server/publisher-operations-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const { releaseId } = await context.params;
  if (!await ignorePublisherRelease(session, releaseId)) return apiError(409, "RELEASE_NOT_IGNORABLE", id, "Release cannot be ignored.");
  return NextResponse.json({ status: "ignored", requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
