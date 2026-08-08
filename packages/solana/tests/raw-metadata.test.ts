import { describe, expect, it, vi } from "vitest";
import {
  FinalizedMetadataVerifier,
  type FinalizedAccountReader,
  type MetadataEvidence
} from "../src/index.js";

const wallet = "D2FDh5vdxdnnTXaZcHjF3sqoAKt5xTxACgRSVqfZbdrw";

function evidence(mint: string, overrides: Partial<MetadataEvidence> = {}): MetadataEvidence {
  return {
    mint,
    metadataAddress: `metadata:${mint}`,
    metadataUri: `https://metadata.example/${mint}.json`,
    updateAuthority: wallet,
    collection: null,
    immutable: false,
    nonFungible: true,
    collectionNft: true,
    accountHash: "a".repeat(64),
    ...overrides
  };
}

function verifierFor(items: readonly MetadataEvidence[]): FinalizedMetadataVerifier {
  const reader: FinalizedAccountReader = {
    getAccount: () => Promise.resolve(null),
    getFinalizedSlot: () => Promise.resolve(4242n)
  };
  const verifier = new FinalizedMetadataVerifier(reader);
  const byMint = new Map(items.map((item) => [item.mint, item]));
  vi.spyOn(verifier, "readMetadata").mockImplementation((mint) => {
    const item = byMint.get(mint);
    if (!item) throw new Error("TOKEN_METADATA_ACCOUNT_MISSING");
    return Promise.resolve(item);
  });
  return verifier;
}

describe("finalized App authority", () => {
  it("accepts the current standalone App collection NFT topology", async () => {
    const app = evidence("app");
    const proof = await verifierFor([app]).verifyAppAuthority({ wallet, appMint: app.mint });

    expect(proof).toMatchObject({
      path: "metadata_update_authority",
      publishingTopology: "standalone_app_collection",
      publisherCollectionMint: null,
      publisherMetadata: null,
      finalizedSlot: 4242n
    });
  });

  it("keeps accepting a verified legacy Publisher collection parent", async () => {
    const app = evidence("app", { collection: { key: "publisher", verified: true } });
    const publisher = evidence("publisher", { immutable: true });
    const proof = await verifierFor([app, publisher]).verifyAppAuthority({ wallet, appMint: app.mint });

    expect(proof).toMatchObject({
      publishingTopology: "publisher_collection",
      publisherCollectionMint: "publisher",
      publisherMetadata: { mint: "publisher" }
    });
  });

  it("rejects a generic NFT that is not an App collection", async () => {
    const app = evidence("app", { collectionNft: false });
    await expect(verifierFor([app]).verifyAppAuthority({ wallet, appMint: app.mint }))
      .rejects.toThrow("APP_MUST_BE_COLLECTION_NFT");
  });

  it("rejects an unverified legacy Publisher collection relationship", async () => {
    const app = evidence("app", { collection: { key: "publisher", verified: false } });
    await expect(verifierFor([app]).verifyAppAuthority({ wallet, appMint: app.mint }))
      .rejects.toThrow("APP_PUBLISHER_COLLECTION_NOT_VERIFIED");
  });
});
