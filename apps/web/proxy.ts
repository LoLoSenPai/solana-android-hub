import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublisherOnboardingEnabled } from "./server/publisher-availability";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function proxy(request: NextRequest): NextResponse {
  if (isPublisherOnboardingEnabled(process.env.HELIUS_API_KEY)) {
    return NextResponse.next();
  }

  const providedRequestId = request.headers.get("x-request-id");
  const requestId = providedRequestId && requestIdPattern.test(providedRequestId)
    ? providedRequestId
    : randomUUID();

  return NextResponse.json({
    error: {
      code: "PUBLISHER_ONBOARDING_UNAVAILABLE",
      message: "Publisher onboarding is not configured for this environment."
    },
    requestId
  }, {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId
    }
  });
}

export const config = {
  matcher: [
    "/api/v1/auth/challenge",
    "/api/v1/auth/verify",
    "/api/v1/publisher/:path*"
  ]
};
