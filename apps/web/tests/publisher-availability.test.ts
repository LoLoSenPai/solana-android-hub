import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { isPublisherOnboardingEnabled } from "../server/publisher-availability";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publisher onboarding availability", () => {
  it("requires a non-empty Helius API key", () => {
    expect(isPublisherOnboardingEnabled(undefined)).toBe(false);
    expect(isPublisherOnboardingEnabled("   ")).toBe(false);
    expect(isPublisherOnboardingEnabled("configured-key")).toBe(true);
  });

  it("fails closed before wallet and publisher APIs when Helius is unavailable", async () => {
    vi.stubEnv("HELIUS_API_KEY", "");
    const requestId = "4ee7bd84-ef4f-4ab0-9338-9c1cebcdf3d6";
    const response = proxy(new NextRequest("https://hub.example/api/v1/auth/challenge", {
      method: "POST",
      headers: { "x-request-id": requestId }
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(requestId);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PUBLISHER_ONBOARDING_UNAVAILABLE",
        message: "Publisher onboarding is not configured for this environment."
      },
      requestId
    });
  });

  it("passes the protected routes through when Helius is configured", () => {
    vi.stubEnv("HELIUS_API_KEY", "configured-key");
    const response = proxy(new NextRequest("https://hub.example/api/v1/publisher/discover-apps"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
