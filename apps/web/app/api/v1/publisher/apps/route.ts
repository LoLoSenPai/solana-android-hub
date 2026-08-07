import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { listPublisherApps } from "@/server/publisher-operations-service";
import { getCurrentSession } from "@/server/session-service";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const session = await getCurrentSession();
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A publisher session is required.");
  const apps = await listPublisherApps(session);
  return NextResponse.json({ apps, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
