import { describe, expect, it } from "vitest";
import { getInstallAction } from "./install-action";

describe("app detail install action", () => {
  it.each([
    ["2", undefined, "install"],
    ["2", "1", "update"],
    ["2", "2", "current"],
    ["1", "2", "newer-installed"]
  ] as const)("maps target %s and installed %s to %s", (target, installed, expected) => {
    expect(getInstallAction(target, installed)).toBe(expected);
  });
});
