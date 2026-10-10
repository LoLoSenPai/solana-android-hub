import { describe, expect, it } from "vitest";
import { PublisherProfileRepository, PublisherProfileSlugConflictError, type HubSql } from "../src/index";

const publisherId = "b34139a4-b7ae-4fce-9b50-6ca59cbd7e25";
const row = {
  id: publisherId, profile_slug: null, display_name: "Studio", bio: null,
  avatar_url: null, portfolio_url: null, profile_links: {}, wallet_address: "private wallet"
};
const input = { slug: "studio", displayName: "Studio", bio: null, avatarUrl: null, portfolioUrl: null,
  links: { website: null, x: null, discord: null, telegram: null } };

function harness(respond: () => unknown = () => [row]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const tag = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve().then(respond);
  }, { json: (value: unknown) => value });
  return { repository: new PublisherProfileRepository(tag as unknown as HubSql), calls };
}

describe("publisher profile repository", () => {
  it("uses the publisher UUID as default slug and exposes no wallet fields", async () => {
    const { repository } = harness();
    const profile = await repository.getById(publisherId);
    expect(profile?.slug).toBe(publisherId);
    expect(profile).not.toHaveProperty("wallet_address");
    expect(profile).not.toHaveProperty("walletAddress");
  });

  it("preserves the UUID public alias without casting untrusted input", async () => {
    const { repository, calls } = harness();
    await repository.getPublicBySlug("malformed-public-path");
    expect(calls[0]?.text).toContain("id::text");
    expect(calls[0]?.text).toContain("status = 'active'");
    expect(calls[0]?.text).not.toContain("::uuid");
  });

  it("updates only the specified active publisher", async () => {
    const { repository, calls } = harness(() => []);
    expect(await repository.update(publisherId, input)).toBeNull();
    expect(calls[0]?.text).toContain("where id = ? and status = 'active'");
    expect(calls[0]?.values).toContain(publisherId);
  });

  it("maps only slug unique conflicts to a dedicated error", async () => {
    const { repository } = harness(() => { throw Object.assign(new Error("unique violation"), { code: "23505", constraint_name: "publishers_profile_slug_unique" }); });
    await expect(repository.update(publisherId, input)).rejects.toBeInstanceOf(PublisherProfileSlugConflictError);
    const otherError = Object.assign(new Error("other unique violation"), { code: "23505", constraint_name: "other_constraint" });
    const other = harness(() => { throw otherError; });
    await expect(other.repository.update(publisherId, input)).rejects.toBe(otherError);
  });
});
