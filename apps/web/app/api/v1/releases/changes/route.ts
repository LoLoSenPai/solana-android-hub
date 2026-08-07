import { NextResponse } from "next/server";
import { z } from "zod";
import { listCatalogChanges } from "@/server/catalog-service";
import { apiError, requestId } from "@/server/http";

const schema = z.object({
  channel: z.enum(["trusted", "approved"]).default("trusted"),
  after: z.iso.datetime({ offset: true }).optional()
});

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    channel: url.searchParams.get("channel") ?? undefined,
    after: url.searchParams.get("after") ?? undefined
  });
  if (!parsed.success) return apiError(400, "INVALID_CURSOR", id, "Release change cursor is invalid.");
  const nextCursor = new Date().toISOString();
  try {
    const items = await listCatalogChanges(parsed.data.channel, parsed.data.after ? new Date(parsed.data.after) : new Date(0));
    return NextResponse.json({ items, nextCursor, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", id, "Release changes are temporarily unavailable.");
  }
}
