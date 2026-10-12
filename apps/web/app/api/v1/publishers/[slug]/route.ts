import { NextResponse } from "next/server";
import { z } from "zod";
import { publicPublisherProfileDtoSchema } from "@hub/api-client";
import { listCatalog } from "../../../../../server/catalog-service";
import { apiError, requestId } from "../../../../../server/http";
import { getPublicPublisherProfile } from "../../../../../server/publisher-profile-service";

const querySchema = z.object({
  channel: z.enum(["trusted", "approved"]).default("trusted")
});

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ channel: url.searchParams.get("channel") ?? undefined });
  if (!parsed.success) return apiError(400, "INVALID_QUERY", id, "The publisher profile query is invalid.");

  try {
    const { slug } = await context.params;
    const profile = await getPublicPublisherProfile(slug);
    if (!profile) return apiError(404, "PUBLISHER_NOT_FOUND", id, "The publisher profile was not found.");
    const apps = await listCatalog({ channel: parsed.data.channel, publisherId: profile.id });
    return NextResponse.json(publicPublisherProfileDtoSchema.parse({ profile, apps }), {
      headers: { "x-request-id": id, "cache-control": "no-store" }
    });
  } catch {
    return apiError(500, "PUBLISHER_PROFILE_UNAVAILABLE", id, "The publisher profile is temporarily unavailable.");
  }
}
