import { describe, expect, it } from "vitest";
import { ReleaseRepository, type HubSql } from "../src/index.js";

describe("official Solana Mobile rating cache", () => {
  it("reads the latest valid aggregate from existing sync results", async () => {
    const sql = (() => Promise.resolve([{
      average_rating: 4.2,
      reviews_by_rating: [0, 1, 3, 4, 8],
      source_reference: "https://dappstore.solanamobile.com/graphql#dAppByAndroidPackage.rating",
      checked_at: "2026-09-03T12:00:00.000Z"
    }])) as unknown as HubSql;

    await expect(new ReleaseRepository(sql).findLatestOfficialStoreRating("app-id")).resolves.toEqual({
      averageRating: 4.2,
      reviewsByRating: [0, 1, 3, 4, 8],
      sourceReference: "https://dappstore.solanamobile.com/graphql#dAppByAndroidPackage.rating",
      checkedAt: "2026-09-03T12:00:00.000Z"
    });
  });

  it("ignores malformed cached aggregates", async () => {
    const sql = (() => Promise.resolve([{
      average_rating: 4.2,
      reviews_by_rating: [1, -1],
      source_reference: "official-provider",
      checked_at: "not-a-date"
    }])) as unknown as HubSql;

    await expect(new ReleaseRepository(sql).findLatestOfficialStoreRating("app-id")).resolves.toBeNull();
  });
});
