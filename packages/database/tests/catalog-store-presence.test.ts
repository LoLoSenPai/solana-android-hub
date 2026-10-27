import { describe, expect, it } from "vitest";
import { CatalogRepository, type HubSql } from "../src/index.js";

const proof = {
  status: "verified", androidPackage: "com.example.game", versionCode: "11",
  checkedAt: "2026-10-27T12:00:00.000Z", sourceReference: "https://dappstore.solanamobile.com/graphql#explore"
};

async function read(checks: unknown, rating: unknown = null) {
  let query = "";
  const sql = ((strings: TemplateStringsArray) => {
    query = strings.join("?");
    return Promise.resolve([{
      app_id: "app", app_mint: "mint", package_name: proof.androidPackage,
      version_code: "10", apk_size: "1024", screenshots: [], release_id: "v10",
      approval_status: null, official_store_checks: checks,
      official_average_rating: rating ? 4 : null, official_reviews_by_rating: rating,
      publisher_links: {}, hub_tags: [], release_updated_at: new Date()
    }]);
  }) as unknown as HubSql;
  const records = await new CatalogRepository(sql).listReleaseCandidates("production");
  return { record: records[0]!, query };
}

describe("catalogue app store presence", () => {
  it("maps official v11 presence independently of the selected v10 approval and private evidence", async () => {
    const { record, query } = await read([{ ...proof, rawResponse: "private", reviewText: "private" }]);
    expect(record.solanaMobileStore).toEqual({ status: "visible", versionCode: "11", checkedAt: proof.checkedAt, sourceReference: proof.sourceReference });
    expect(record.release.versionCode).toBe(10n);
    expect(record.release.approvalStatus).toBe("unknown");
    expect(query).toContain("job.status in ('succeeded', 'failed')");
    expect(query).toContain("'{officialApproval,androidPackage}' = a.package_name");
    expect(query).toContain("order by job.completed_at desc, job.created_at desc, job.id desc");
  });

  it.each(["verified", "release_not_found"])("treats %s as visible", async (status) => {
    expect((await read([{ ...proof, status }])).record.solanaMobileStore?.status).toBe("visible");
  });

  it("keeps HeroStars not visible even when it has ratings", async () => {
    const { record } = await read([{ ...proof, status: "not_visible", versionCode: null }], [0, 0, 0, 0, 2]);
    expect(record.solanaMobileStore?.status).toBe("not_visible");
    expect(record.solanaMobileRating).not.toBeNull();
  });

  it("preserves the last conclusive result after unavailable or malformed later observations", async () => {
    const { record } = await read([
      { ...proof, status: "unavailable" },
      { ...proof, androidPackage: "com.other.app" },
      { ...proof, sourceReference: "https://untrusted.example" },
      { ...proof, checkedAt: "2026-02-30T12:00:00.000Z" },
      { ...proof, versionCode: "0" },
      proof
    ]);
    expect(record.solanaMobileStore?.versionCode).toBe("11");
  });

  it("does not infer app presence from a rating or a release approval", async () => {
    expect((await read(null, [0, 0, 0, 0, 2])).record.solanaMobileStore).toBeNull();
    expect((await read([{ ...proof, status: "unavailable" }])).record.solanaMobileStore).toBeNull();
  });
});
