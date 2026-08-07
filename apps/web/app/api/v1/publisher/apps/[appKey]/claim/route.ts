import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { claimPublisherApp } from "@/server/publisher-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const { appKey: appMint } = await context.params;
  try {
    const app = await claimPublisherApp(session, appMint);
    return NextResponse.json({ app, requestId: id }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch (error) {
    const code = error instanceof Error && error.message === "APP_ALREADY_CLAIMED" ? "APP_ALREADY_CLAIMED" : "APP_AUTHORITY_REJECTED";
    return apiError(code === "APP_ALREADY_CLAIMED" ? 409 : 403, code, id, "The App NFT claim could not be verified.");
  }
}
