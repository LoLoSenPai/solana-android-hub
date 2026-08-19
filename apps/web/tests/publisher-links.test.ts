import { describe, expect, it } from "vitest";
import { normalizePublisherLinks, PublisherLinkValidationError } from "../server/publisher-links";

describe("publisher links", () => {
  it("normalizes supported community profiles", () => {
    expect(normalizePublisherLinks({
      website: "https://example.com/app",
      x: "https://twitter.com/DapportApp/",
      discord: "https://discord.com/invite/DaPp0rt",
      telegram: "https://telegram.me/dapport_app"
    })).toEqual({
      website: "https://example.com/app",
      x: "https://x.com/DapportApp",
      discord: "https://discord.gg/DaPp0rt",
      telegram: "https://t.me/dapport_app"
    });
  });

  it("turns blank fields into absent links", () => {
    expect(normalizePublisherLinks({ website: "", x: null })).toEqual({
      website: null,
      x: null,
      discord: null,
      telegram: null
    });
  });

  it.each([
    { website: "http://example.com" },
    { website: "https://localhost:3000" },
    { x: "https://example.com/dapport" },
    { discord: "https://discord.com/channels/123/456" },
    { telegram: "https://t.me/share/url?url=https://example.com" }
  ])("rejects unsafe or non-profile links: %o", (links) => {
    expect(() => normalizePublisherLinks(links)).toThrow(PublisherLinkValidationError);
  });
});
