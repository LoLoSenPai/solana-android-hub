import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession, logoutCurrentSession } from "@/server/session-service";

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  if (!await getCurrentSession(request, true)) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  await logoutCurrentSession();
  return NextResponse.json({ ok: true, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
