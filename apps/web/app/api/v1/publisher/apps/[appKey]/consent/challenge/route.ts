import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { createDistributionConsentChallenge } from "@/server/publisher-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const bodySchema = z.object({ releasePolicy: z.enum(["automatic", "manual"]) }).strict();

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const requestIdentifier = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", requestIdentifier, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", requestIdentifier, "A valid session and CSRF token are required.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_REQUEST", requestIdentifier, "A release policy is required.");
  const { appKey: id } = await context.params;
  try {
    const challenge = await createDistributionConsentChallenge(session, id, parsed.data.releasePolicy);
    return NextResponse.json({ ...challenge, requestId: requestIdentifier }, { headers: { "cache-control": "no-store", "x-request-id": requestIdentifier } });
  } catch {
    return apiError(403, "APP_AUTHORITY_REJECTED", requestIdentifier, "Current App NFT authority could not be verified.");
  }
}
