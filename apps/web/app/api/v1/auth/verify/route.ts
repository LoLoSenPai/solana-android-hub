import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { setSessionCookies, verifyAuthenticationChallenge } from "@/server/session-service";
import { enforceRateLimit } from "@/server/security-service";

const bodySchema = z.object({
  challengeId: z.uuid(),
  signature: z.string().min(80).max(100)
}).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_REQUEST", id, "Challenge verification data is invalid.");
  if (!await enforceRateLimit({ request, routeClass: "auth_verify", subject: parsed.data.challengeId, limit: 10, windowSeconds: 300 })) {
    return apiError(429, "RATE_LIMITED", id, "Too many authentication attempts were made.");
  }
  const created = await verifyAuthenticationChallenge(parsed.data.challengeId, parsed.data.signature);
  if (!created) return apiError(401, "SIGNATURE_REJECTED", id, "The challenge is invalid, expired, consumed, or incorrectly signed.");
  await setSessionCookies(created);
  return NextResponse.json({
    wallet: created.session.walletAddress,
    expiresAt: created.session.absoluteExpiresAt.toISOString(),
    requestId: id
  }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
