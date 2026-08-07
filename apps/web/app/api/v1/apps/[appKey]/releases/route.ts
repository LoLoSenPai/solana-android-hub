import { NextResponse } from "next/server";
import { listCatalogReleases } from "@/server/catalog-service";
import { apiError, requestId } from "@/server/http";

export async function GET(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const channel = new URL(request.url).searchParams.get("channel") === "approved" ? "approved" : "trusted";
  const { appKey: appId } = await context.params;
  try {
    const releases = await listCatalogReleases(appId, channel);
    return NextResponse.json({ releases, requestId: id }, { headers: { "cache-control": "public, max-age=30", "x-request-id": id } });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", id, "The catalogue is temporarily unavailable.");
  }
}
