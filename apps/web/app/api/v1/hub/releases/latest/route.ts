import { NextResponse } from "next/server";
import { hubReleaseManifestFromEnvironment } from "../../../../../../server/hub-release-manifest";

export function GET(): NextResponse {
  const manifest = hubReleaseManifestFromEnvironment(process.env);
  if (!manifest) {
    return NextResponse.json({
      error: {
        code: "HUB_UPDATE_UNAVAILABLE",
        message: "The Hub update manifest is not configured."
      }
    }, {
      status: 503,
      headers: { "cache-control": "no-store" }
    });
  }
  return NextResponse.json(manifest, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
  });
}
