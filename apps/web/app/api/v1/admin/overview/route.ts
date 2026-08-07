import { NextResponse } from "next/server";
import { getAdminOverview, isAdmin } from "@/server/admin-service";
import { apiError, requestId } from "@/server/http";
import { getCurrentSession } from "@/server/session-service";

export async function GET(request: Request): Promise<NextResponse> {
  const id = requestId(request);
  const session = await getCurrentSession();
  if (!isAdmin(session)) return apiError(403, "ADMIN_REQUIRED", id, "An allowlisted admin wallet is required.");
  const overview = await getAdminOverview(session);
  return NextResponse.json({ ...overview, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
}
