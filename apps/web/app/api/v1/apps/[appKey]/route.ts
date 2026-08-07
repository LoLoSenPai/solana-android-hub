import { NextResponse } from "next/server";
import { getCatalogApp } from "../../../../../server/catalog-service";
import { apiError, requestId } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ appKey: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  const { appKey: slug } = await context.params;
  const channel = new URL(request.url).searchParams.get("channel") === "approved" ? "approved" : "trusted";
  try {
    const app = await getCatalogApp(slug, channel);
    if (!app) return apiError(404, "APP_NOT_FOUND", id, "No eligible app was found.");
    return NextResponse.json({ app, requestId: id }, { headers: { "x-request-id": id } });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", id, "The catalogue is temporarily unavailable.");
  }
}
