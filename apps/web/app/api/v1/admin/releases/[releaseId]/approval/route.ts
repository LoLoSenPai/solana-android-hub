import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, setReleaseApproval } from "@/server/admin-service";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const schema = z.object({
  status: z.enum(["verified_approved", "rejected"]),
  sourceReference: z.string().url().max(500),
  evidence: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(4).max(1000)
}).strict();

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!isAdmin(session)) return apiError(403, "ADMIN_REQUIRED", id, "An allowlisted admin wallet is required.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "APPROVAL_EVIDENCE_INVALID", id, "Approval evidence is invalid.");
  const { releaseId } = await context.params;
  try {
    await setReleaseApproval(session, { releaseId, ...parsed.data, requestId: id });
    return NextResponse.json({ status: parsed.data.status, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  } catch {
    return apiError(404, "RELEASE_NOT_FOUND", id, "Release was not found.");
  }
}
