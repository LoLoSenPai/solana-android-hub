import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { syncDuePublisherApps } from "@/server/release-sync-service";
import { hubConfig } from "@/server/runtime";

export async function POST(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!validCronSecret(request)) return apiError(401, "CRON_AUTH_REJECTED", id, "Cron authentication was rejected.");
  if (!hubConfig.heliusApiKey) return apiError(503, "HELIUS_NOT_CONFIGURED", id, "Release synchronization is not configured.");
  const results = await syncDuePublisherApps();
  return NextResponse.json({ attempted: results.length, results, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}

function validCronSecret(request: Request): boolean {
  const observed = request.headers.get("authorization")?.match(/^Bearer (.+)$/u)?.[1];
  const expected = hubConfig.cronSecret;
  if (!observed || !expected) return false;
  const left = Buffer.from(observed, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
