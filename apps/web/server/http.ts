import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function requestId(request: Request): string {
  const provided = request.headers.get("x-request-id");
  return provided && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(provided)
    ? provided
    : randomUUID();
}

export function apiError(status: number, code: string, id: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message }, requestId: id }, {
    status,
    headers: { "x-request-id": id, "cache-control": "no-store" }
  });
}

export function hasExpectedOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === expectedOrigin && origin === expectedOrigin;
  } catch {
    return false;
  }
}
