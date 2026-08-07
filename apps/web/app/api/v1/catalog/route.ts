import { NextResponse } from "next/server";
import { z } from "zod";
import { listCatalog } from "../../../../server/catalog-service";
import { apiError, requestId } from "../../../../server/http";
import { hubConfig } from "../../../../server/runtime";

const querySchema = z.object({
  channel: z.enum(["trusted", "approved"]).default("trusted"),
  query: z.string().trim().min(1).max(100).optional()
});

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    channel: url.searchParams.get("channel") ?? undefined,
    query: url.searchParams.get("query") ?? undefined
  });
  if (!parsed.success) return apiError(400, "INVALID_QUERY", id, "The catalogue query is invalid.");

  try {
    const items = await listCatalog({
      channel: parsed.data.channel,
      ...(parsed.data.query === undefined ? {} : { query: parsed.data.query })
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
