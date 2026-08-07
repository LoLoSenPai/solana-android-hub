import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { discoverPublisherApps } from "@/server/publisher-service";
import { getCurrentSession } from "@/server/session-service";
import { enforceRateLimit } from "@/server/security-service";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const session = await getCurrentSession();
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A publisher session is required.");
  if (!await enforceRateLimit({ request, routeClass: "publisher_discovery", subject: session.walletAddress, limit: 12, windowSeconds: 300 })) {
    return apiError(429, "RATE_LIMITED", id, "Publisher discovery is temporarily rate limited.");
  }
  try {
    const apps = await discoverPublisherApps(session);
    return NextResponse.json({ apps, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(503, "SOLANA_VERIFICATION_UNAVAILABLE", id, "Finalized Solana verification is unavailable.");
  }
}
