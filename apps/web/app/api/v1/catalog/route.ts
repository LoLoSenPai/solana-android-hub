import { NextResponse } from "next/server";
import { z } from "zod";
import { catalogCategorySchema, catalogSortSchema } from "@hub/api-client";
import { listCatalog } from "../../../../server/catalog-service";
import { apiError, requestId } from "../../../../server/http";
import { hubConfig } from "../../../../server/runtime";

const querySchema = z.object({
  channel: z.enum(["trusted", "approved"]).default("trusted"),
  query: z.string().trim().min(1).max(100).optional(),
  category: catalogCategorySchema.optional(),
  sort: catalogSortSchema.default("name"),
  androidSdk: z.coerce.number().int().min(1).max(100).optional()
});

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    channel: url.searchParams.get("channel") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    androidSdk: url.searchParams.get("androidSdk") ?? undefined
  });
  if (!parsed.success) return apiError(400, "INVALID_QUERY", id, "The catalogue query is invalid.");

  try {
    const items = await listCatalog({
      channel: parsed.data.channel,
      sort: parsed.data.sort,
      ...(parsed.data.query === undefined ? {} : { query: parsed.data.query }),
      ...(parsed.data.category === undefined ? {} : { category: parsed.data.category }),
      ...(parsed.data.androidSdk === undefined ? {} : { androidSdk: parsed.data.androidSdk })
    });
    return NextResponse.json({ items, nextCursor: null, requestId: id }, {
      headers: {
        "x-request-id": id,
        "cache-control": hubConfig.appEnvironment === "local" ? "no-store" : "public, max-age=30, stale-while-revalidate=120"
      }
    });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", id, "The catalogue is temporarily unavailable.");
  }
}
