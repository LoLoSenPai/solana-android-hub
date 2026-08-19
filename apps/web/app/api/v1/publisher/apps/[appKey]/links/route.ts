import { NextResponse } from "next/server";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { normalizePublisherLinks, PublisherLinkValidationError, publisherLinksInputSchema } from "@/server/publisher-links";
import { updatePublisherLinks } from "@/server/publisher-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const parsed = publisherLinksInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_PUBLISHER_LINKS", id, "Provide valid website, X, Discord, or Telegram links.");
  const { appKey: appId } = await context.params;
  try {
    const publisherLinks = normalizePublisherLinks(parsed.data);
    const saved = await updatePublisherLinks({ session, appId, links: publisherLinks });
    if (!saved) return apiError(404, "APP_NOT_FOUND", id, "The claimed app was not found.");
    return NextResponse.json({ publisherLinks, requestId: id }, {
      headers: { "cache-control": "no-store", "x-request-id": id }
    });
  } catch (error) {
    if (error instanceof PublisherLinkValidationError) {
      return apiError(400, "INVALID_PUBLISHER_LINKS", id, error.message);
    }
    return apiError(403, "APP_AUTHORITY_REJECTED", id, "Current App NFT authority could not be verified.");
  }
}
