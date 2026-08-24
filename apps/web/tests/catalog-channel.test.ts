import { describe, expect, it } from "vitest";
import { appHref, catalogChannelFromParam, catalogHref } from "../app/catalog/catalog-channel";

describe("catalogue channel URLs", () => {
  it("defaults unknown and missing values to the full Dapport catalogue", () => {
    expect(catalogChannelFromParam(undefined)).toBe("trusted");
    expect(catalogChannelFromParam("anything-else")).toBe("trusted");
  });

  it("keeps the approved channel in category and app links", () => {
    expect(catalogChannelFromParam(["approved"])).toBe("approved");
    expect(catalogHref({ channel: "approved", category: "games", view: "list" })).toBe("/catalog?category=games&channel=approved&view=list");
    expect(appHref("degenmerge", "approved")).toBe("/apps/degenmerge?channel=approved");
  });

  it("keeps trusted URLs clean", () => {
    expect(catalogHref({ channel: "trusted", category: "games" })).toBe("/catalog?category=games");
    expect(appHref("degenmerge", "trusted")).toBe("/apps/degenmerge");
  });
});
