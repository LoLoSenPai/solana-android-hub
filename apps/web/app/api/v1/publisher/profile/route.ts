import { NextResponse } from "next/server";
import { PublisherProfileSlugConflictError } from "@hub/database";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { PublisherLinkValidationError } from "@/server/publisher-links";
import { normalizePublisherProfile, publisherProfileInputSchema } from "@/server/publisher-profile-input";
import { getPublisherProfile, publisherProfilePublicUrl, updatePublisherProfile } from "@/server/publisher-profile-service";
import { hubConfig } from "@/server/runtime";
import { enforceRateLimit } from "@/server/security-service";
import { getCurrentSession } from "@/server/session-service";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  try {
    const session = await getCurrentSession();
    if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid publisher session is required.");
    const profile = await getPublisherProfile(session);
    if (!profile) return apiError(404, "PUBLISHER_NOT_FOUND", id, "An active publisher profile was not found.");
    return NextResponse.json({ profile, publicUrl: publisherProfilePublicUrl(profile), requestId: id }, {
      headers: { "cache-control": "no-store", "x-request-id": id }
    });
  } catch {
    return apiError(503, "PROFILE_UNAVAILABLE", id, "Publisher profiles are temporarily unavailable.");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  try {
    const session = await getCurrentSession(request, true);
    if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
    if (!await enforceRateLimit({ request, routeClass: "publisher_mutation", subject: session.publisherId, limit: 30, windowSeconds: 60 })) {
      return apiError(429, "RATE_LIMITED", id, "Too many profile updates. Please try again shortly.");
    }
    const parsed = publisherProfileInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_PUBLISHER_PROFILE", id, parsed.error.issues[0]?.message ?? "Provide a valid publisher profile.");
    const profile = await updatePublisherProfile(session, normalizePublisherProfile(parsed.data));
    if (!profile) return apiError(404, "PUBLISHER_NOT_FOUND", id, "An active publisher profile was not found.");
    return NextResponse.json({ profile, publicUrl: publisherProfilePublicUrl(profile), requestId: id }, {
      headers: { "cache-control": "no-store", "x-request-id": id }
    });
  } catch (error) {
    if (error instanceof PublisherLinkValidationError) return apiError(400, "INVALID_PUBLISHER_PROFILE", id, error.message);
    if (error instanceof PublisherProfileSlugConflictError) return apiError(409, "PUBLISHER_SLUG_TAKEN", id, error.message);
    return apiError(503, "PROFILE_UNAVAILABLE", id, "Publisher profiles are temporarily unavailable.");
  }
}
