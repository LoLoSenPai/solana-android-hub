import { NextResponse } from "next/server";
import { listCatalogReleases } from "@/server/catalog-service";
import { apiError, requestId } from "@/server/http";

export async function GET(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const channel = new URL(request.url).searchParams.get("channel") === "approved" ? "approved" : "trusted";
  const { appKey: appId } = await context.params;
  try {
    const release = (await listCatalogReleases(appId, channel))[0];
    if (!release) return apiError(404, "RELEASE_NOT_FOUND", id, "No eligible Release exists in this channel.");
    return NextResponse.json({ release, requestId: id }, { headers: { "cache-control": "public, max-age=30", "x-request-id": id } });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", id, "The catalogue is temporarily unavailable.");
  }
}
