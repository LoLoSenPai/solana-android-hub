import { describe, expect, it } from "vitest";
import { classifyExternalDependencyFailure, redactExternalDependencyMessage } from "../server/dependency-errors";

describe("classifyExternalDependencyFailure", () => {
  it.each([
    [new Error("RPC error (searchAssets): invalid API key"), "authentication"],
    [new Error("RPC error (searchAssets): rate limit exceeded"), "capacity"],
    [new Error("fetch failed: socket closed"), "network"],
    [new Error("RPC error (searchAssets): invalid parameters"), "rpc"],
    [new Error("unexpected"), "unknown"],
    [null, "unknown"]
  ] as const)("maps a provider failure without exposing its raw message", (error, expected) => {
    expect(classifyExternalDependencyFailure(error)).toBe(expected);
  });

  it("redacts provider URLs, keys, and other long identifiers", () => {
    const key = "11111111-2222-3333-4444-555555555555";
    const message = redactExternalDependencyMessage(new Error(
      `RPC error (searchAssets): request https://mainnet.helius-rpc.com/?api-key=${key} failed for ${key}`
    ));
    expect(message).toContain("RPC error (searchAssets)");
    expect(message).not.toContain("helius-rpc.com");
    expect(message).not.toContain(key);
  });
});
