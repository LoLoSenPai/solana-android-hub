import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";
import { publishValidatedRelease, requestBinaryValidation } from "@/server/validation-service";

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const { releaseId } = await context.params;
  try {
    const published = await publishValidatedRelease(session, releaseId);
    return NextResponse.json({ status: "published", release: published, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    try {
      const validation = await requestBinaryValidation(session, releaseId);
      return NextResponse.json({ ...validation, requestId: id }, { status: 202, headers: { "cache-control": "no-store", "x-request-id": id } });
    } catch (error) {
      const code = error instanceof Error ? error.message : "RELEASE_NOT_PUBLISHABLE";
      const unavailable = code === "VALIDATOR_NOT_CONFIGURED" || code.startsWith("VALIDATOR_DISPATCH_");
      return apiError(unavailable ? 503 : 409, unavailable ? "VALIDATOR_UNAVAILABLE" : "RELEASE_NOT_PUBLISHABLE", id,
        unavailable ? "Server APK validation is not configured." : "Release cannot be published in its current state.");
    }
  }
}
