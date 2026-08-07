import { publicRuntimeConfig } from "@hub/config";
import { NextResponse } from "next/server";
import { hubConfig } from "../../../../server/runtime";

export function GET(): NextResponse {
  return NextResponse.json(publicRuntimeConfig(hubConfig), {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
  });
}
