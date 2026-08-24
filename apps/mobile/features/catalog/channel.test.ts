import { describe, expect, it } from "vitest";
import { normalizeCatalogChannel } from "./channel";

describe("mobile catalogue channel", () => {
  it("restores the approved preference instead of rewriting it", () => {
    expect(normalizeCatalogChannel("approved")).toBe("approved");
  });

  it("fails closed to the full Dapport catalogue for unknown stored values", () => {
    expect(normalizeCatalogChannel("legacy-value")).toBe("trusted");
    expect(normalizeCatalogChannel(null)).toBe("trusted");
  });
});
