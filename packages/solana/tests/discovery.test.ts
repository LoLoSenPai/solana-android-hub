import type { Asset } from "helius-sdk/types/das";
import { describe, expect, it } from "vitest";
import { HeliusReleaseDiscovery, type DasDiscoveryClient, type DasSearchParameters } from "../src/index.js";

function asset(id: string): Asset {
  return {
    interface: "V1_NFT",
    id,
    ownership: { frozen: false, delegated: false, ownership_model: "single", owner: "owner" },
    mutable: false,
    burnt: false,
    grouping: [{ group_key: "collection", group_value: "app", verified: true }]
  };
}

describe("DAS discovery", () => {
  it("deduplicates authority and ownership candidates without treating either as proof", async () => {
    const searches: DasSearchParameters[] = [];
    const das: DasDiscoveryClient = {
      searchAssets: (query) => {
        searches.push(query);
        return Promise.resolve({ items: query.authorityAddress ? [asset("one")] : [asset("one"), asset("two")], total: query.authorityAddress ? 1 : 2 });
      },
      getAssetsByGroup: () => Promise.resolve({ items: [], total: 0 })
    };
    const result = await new HeliusReleaseDiscovery(das).discoverWalletCandidates("wallet");
    expect(result.map((candidate) => candidate.mint)).toEqual(["one", "two"]);
    expect(searches).toEqual(expect.arrayContaining([
      { authorityAddress: "wallet", page: 1, limit: 1000 },
      { ownerAddress: "wallet", tokenType: "nonFungible", page: 1, limit: 1000 }
    ]));
  });

  it("starts group pagination at page one", async () => {
    const pages: number[] = [];
    const das: DasDiscoveryClient = {
      searchAssets: () => Promise.resolve({ items: [], total: 0 }),
      getAssetsByGroup: (query) => {
        pages.push(query.page);
        return Promise.resolve({ items: [asset("release")], total: 1 });
      }
    };
    await new HeliusReleaseDiscovery(das).discoverReleases("app");
    expect(pages).toEqual([1]);
  });
});
