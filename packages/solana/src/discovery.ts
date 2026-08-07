import type { Asset } from "helius-sdk/types/das";
import { createHelius, type HeliusClient } from "helius-sdk";

const PAGE_SIZE = 1000;

export interface DiscoveryAsset {
  mint: string;
  metadataUri: string | null;
  indexedSlot: number | null;
  mutable: boolean;
  burnt: boolean;
  compression: "uncompressed" | "compressed";
  verifiedCollections: readonly string[];
}

export interface DasDiscoveryClient {
  searchAssets(parameters: {
    authorityAddress?: string;
    ownerAddress?: string;
    tokenType: "nonFungible";
    page: number;
    limit: number;
  }): Promise<{ items: readonly Asset[]; total: number }>;
  getAssetsByGroup(parameters: {
    groupKey: "collection";
    groupValue: string;
    page: number;
    limit: number;
  }): Promise<{ items: readonly Asset[]; total: number }>;
}

export class HeliusReleaseDiscovery {
  public constructor(private readonly das: DasDiscoveryClient) {}

  public async discoverWalletCandidates(wallet: string): Promise<readonly DiscoveryAsset[]> {
    const [authorityAssets, ownerAssets] = await Promise.all([
      this.paginate((page) => this.das.searchAssets({ authorityAddress: wallet, tokenType: "nonFungible", page, limit: PAGE_SIZE })),
      this.paginate((page) => this.das.searchAssets({ ownerAddress: wallet, tokenType: "nonFungible", page, limit: PAGE_SIZE }))
    ]);
    return dedupe([...authorityAssets, ...ownerAssets]).map(mapAsset);
  }

  public async discoverReleases(appMint: string): Promise<readonly DiscoveryAsset[]> {
    const assets = await this.paginate((page) => this.das.getAssetsByGroup({
      groupKey: "collection",
      groupValue: appMint,
      page,
      limit: PAGE_SIZE
    }));
    return dedupe(assets).map(mapAsset);
  }

  private async paginate(
    load: (page: number) => Promise<{ items: readonly Asset[]; total: number }>
  ): Promise<readonly Asset[]> {
    const output: Asset[] = [];
    for (let page = 1; ; page += 1) {
      const result = await load(page);
      output.push(...result.items);
      if (result.items.length < PAGE_SIZE || output.length >= result.total) return output;
    }
  }
}

export function createHeliusReleaseDiscovery(apiKey: string): HeliusReleaseDiscovery {
  const client: HeliusClient = createHelius({ apiKey, network: "mainnet", userAgent: "solana-android-hub/0.1" });
  return new HeliusReleaseDiscovery(client);
}

function dedupe(assets: readonly Asset[]): readonly Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}

function mapAsset(asset: Asset): DiscoveryAsset {
  return {
    mint: asset.id,
    metadataUri: asset.content?.json_uri ?? null,
    indexedSlot: asset.last_indexed_slot ?? null,
    mutable: asset.mutable,
    burnt: asset.burnt,
    compression: asset.compression?.compressed === true ? "compressed" : "uncompressed",
    verifiedCollections: (asset.grouping ?? [])
      .filter((group) => group.group_key === "collection" && group.verified === true)
      .map((group) => group.group_value)
  };
}
