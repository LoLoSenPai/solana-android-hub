import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, suspendApp } from "@/server/admin-service";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const schema = z.object({ reason: z.string().trim().min(4).max(1000) }).strict();

export async function POST(request: Request, context: { params: Promise<{ appId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!isAdmin(session)) return apiError(403, "ADMIN_REQUIRED", id, "An allowlisted admin wallet is required.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "SUSPENSION_REASON_INVALID", id, "A suspension reason is required.");
  const { appId } = await context.params;
  try {
    await suspendApp(session, { appId, reason: parsed.data.reason, requestId: id });
    return NextResponse.json({ status: "suspended", requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(404, "APP_NOT_FOUND", id, "App was not found.");
  }
}
