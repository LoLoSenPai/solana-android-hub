import { describe, expect, it } from "vitest";
import { classifyExternalDependencyFailure } from "../server/dependency-errors";

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
});
