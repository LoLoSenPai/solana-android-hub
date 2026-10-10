import { describe, expect, it } from "vitest";
import { normalizePublisherProfile, publisherProfileInputSchema } from "../server/publisher-profile-input";

describe("publisher profile input", () => {
  it("normalizes a custom slug and empty optional fields", () => {
    expect(normalizePublisherProfile(publisherProfileInputSchema.parse({
      slug: "  Dapport-Studio  ", displayName: "  Studio  ", bio: " ", avatarUrl: "", portfolioUrl: null,
      links: { x: "https://twitter.com/dapportapp/" }
    }))).toEqual({
      slug: "dapport-studio", displayName: "Studio", bio: null, avatarUrl: null, portfolioUrl: null,
      links: { website: null, x: "https://x.com/dapportapp", discord: null, telegram: null }
    });
  });

  it("uses the default slug when the custom slug is removed", () => {
    expect(normalizePublisherProfile(publisherProfileInputSchema.parse({ slug: " " })).slug).toBeNull();
  });

  it.each(["ab", "a".repeat(49), "1publisher", "publisher_name", "019a1257-dded-7353-8a76-6ae3767944cc", "b34139a4-b7ae-4fce-9b50-6ca59cbd7e25"])("rejects malformed or UUID slugs %s", (slug) => {
    expect(publisherProfileInputSchema.safeParse({ slug }).success).toBe(false);
  });

  it("enforces text limits and rejects arbitrary public fields", () => {
    expect(publisherProfileInputSchema.safeParse({ displayName: "a".repeat(121) }).success).toBe(false);
    expect(publisherProfileInputSchema.safeParse({ bio: "a".repeat(1001) }).success).toBe(false);
    expect(publisherProfileInputSchema.safeParse({ walletAddress: "wallet" }).success).toBe(false);
  });

  it.each(["http://example.com/avatar.png", "https://localhost/avatar.png", "https://127.0.0.1/avatar.png", "https://[::1]/avatar.png", "https://user:pass@example.com/avatar.png", "https://internal.local/avatar.png"])("rejects unsafe avatar and portfolio URLs %s", (url) => {
    for (const field of ["avatarUrl", "portfolioUrl"]) {
      expect(() => normalizePublisherProfile(publisherProfileInputSchema.parse({ [field]: url }))).toThrow();
    }
  });
});
