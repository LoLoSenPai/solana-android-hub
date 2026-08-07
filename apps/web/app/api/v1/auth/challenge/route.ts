import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { createAuthenticationChallenge } from "@/server/session-service";
import { enforceRateLimit } from "@/server/security-service";

const bodySchema = z.object({ wallet: z.string().min(32).max(44) }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_REQUEST", id, "A valid wallet address is required.");
  if (!await enforceRateLimit({ request, routeClass: "auth_challenge", subject: parsed.data.wallet, limit: 8, windowSeconds: 300 })) {
    return apiError(429, "RATE_LIMITED", id, "Too many authentication challenges were requested.");
  }
  try {
    const challenge = await createAuthenticationChallenge(parsed.data.wallet);
    return NextResponse.json({ ...challenge, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(400, "INVALID_WALLET", id, "A valid Solana wallet address is required.");
  }
}
