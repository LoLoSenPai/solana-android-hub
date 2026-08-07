import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasExpectedOrigin, requestId } from "@/server/http";
import { requestPublisherApproval } from "@/server/publisher-operations-service";
import { hubConfig } from "@/server/runtime";
import { getCurrentSession } from "@/server/session-service";

const schema = z.object({ evidence: z.record(z.string(), z.unknown()).default({}) }).strict();

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }): Promise<NextResponse> {
  const id = requestId(request);
  if (!hasExpectedOrigin(request, hubConfig.hubOrigin)) return apiError(403, "ORIGIN_REJECTED", id, "Request origin was rejected.");
  const session = await getCurrentSession(request, true);
  if (!session) return apiError(401, "SESSION_REQUIRED", id, "A valid session and CSRF token are required.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "APPROVAL_REQUEST_INVALID", id, "Approval request evidence is invalid.");
  const { releaseId } = await context.params;
  const approvalRequestId = await requestPublisherApproval(session, releaseId, parsed.data.evidence);
  if (!approvalRequestId) return apiError(409, "APPROVAL_REQUEST_EXISTS", id, "A pending approval request already exists or the Release is unavailable.");
  return NextResponse.json({ approvalRequestId, requestId: id }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": id } });
}
