import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, requestId } from "@/server/http";
import { syncDuePublisherApps } from "@/server/release-sync-service";
import { hubConfig } from "@/server/runtime";

export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  return runSync(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return runSync(request);
}

async function runSync(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  if (!validCronSecret(request)) return apiError(401, "CRON_AUTH_REJECTED", id, "Cron authentication was rejected.");
  if (!hubConfig.heliusApiKey) return apiError(503, "HELIUS_NOT_CONFIGURED", id, "Release synchronization is not configured.");
  let force = false;
  if (request.method === "POST" && request.body) {
    try {
      const text = await request.text();
      if (text.length > 1024) throw new Error("BODY_TOO_LARGE");
      const body: unknown = JSON.parse(text || "{}");
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some((key) => key !== "force")
        || ("force" in body && typeof body.force !== "boolean")) throw new Error("INVALID_BODY");
      force = "force" in body && body.force === true;
    } catch {
      return apiError(400, "INVALID_SYNC_OPTIONS", id, "Sync options are invalid.");
    }
  }
  const results = await syncDuePublisherApps(20, force);
  const incomplete = results.filter((result) => result.status === "failed" || result.status === "partial").length;
  return NextResponse.json({ attempted: results.length, incomplete, results, requestId: id }, {
    status: incomplete ? 503 : 200,
    headers: { "cache-control": "no-store", "x-request-id": id }
  });
}

function validCronSecret(request: Request): boolean {
  const observed = request.headers.get("authorization")?.match(/^Bearer (.+)$/u)?.[1];
  const expected = hubConfig.cronSecret;
  if (!observed || !expected) return false;
  const left = Buffer.from(observed, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
