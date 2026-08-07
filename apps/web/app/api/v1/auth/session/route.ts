import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { getCurrentSession } from "@/server/session-service";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const session = await getCurrentSession();
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "No active publisher session exists.");
  return NextResponse.json({ wallet: session.walletAddress, expiresAt: session.absoluteExpiresAt.toISOString(), requestId: id }, {
    headers: { "cache-control": "no-store", "x-request-id": id }
  });
}
