import { describe, expect, it } from "vitest";
import { fetchHardenedJson, isNonPublicAddress } from "../src/index.js";

describe("hardened metadata fetch", () => {
  it("rejects private and loopback address ranges", () => {
    expect(isNonPublicAddress("127.0.0.1")).toBe(true);
    expect(isNonPublicAddress("10.1.2.3")).toBe(true);
    expect(isNonPublicAddress("::1")).toBe(true);
    expect(isNonPublicAddress("8.8.8.8")).toBe(false);
  });

  it("revalidates redirect destinations and blocks private DNS results", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response(null, {
      status: 302,
      headers: { location: "https://internal.example/metadata.json" }
    }));
    const resolveHostname = (hostname: string) => Promise.resolve(
      hostname === "public.example" ? ["8.8.8.8"] : ["127.0.0.1"]
    );
    await expect(fetchHardenedJson("https://public.example/start", { fetchImpl, resolveHostname }))
      .rejects.toThrow("UNSAFE_METADATA_ADDRESS");
  });

  it("rejects streamed bodies over the configured limit", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response("{\"tooLarge\":true}", { status: 200 }));
    await expect(fetchHardenedJson("https://public.example/metadata.json", {
      fetchImpl,
      resolveHostname: () => Promise.resolve(["8.8.8.8"]),
      maxBytes: 4
    })).rejects.toThrow("METADATA_TOO_LARGE");
  });
});
