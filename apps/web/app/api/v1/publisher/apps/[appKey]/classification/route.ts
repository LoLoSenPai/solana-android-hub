import { catalogCategorySchema, gameGenreSchema } from "@hub/api-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { updatePublisherClassification } from "@/server/publisher-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const bodySchema = z.object({
  category: catalogCategorySchema,
  genres: z.array(gameGenreSchema).max(4).default([])
}).strict().refine((value) => value.category === "games" || value.genres.length === 0, {
  message: "Genres are only available for games."
});

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_CLASSIFICATION", id, "Choose one category and up to four valid game genres.");
  const { appKey: appId } = await context.params;
  try {
    const saved = await updatePublisherClassification({ session, appId, ...parsed.data });
    if (!saved) return apiError(404, "APP_NOT_FOUND", id, "The claimed app was not found.");
    return NextResponse.json({ category: parsed.data.category, genres: parsed.data.genres, requestId: id }, {
      headers: { "cache-control": "no-store", "x-request-id": id }
    });
  } catch {
    return apiError(403, "APP_AUTHORITY_REJECTED", id, "Current App NFT authority could not be verified.");
  }
}
