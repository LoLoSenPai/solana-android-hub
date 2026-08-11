import { createHash } from "node:crypto";
import {
  getCollectionAuthorityRecordAccountDataSerializer,
  getMetadataAccountDataSerializer,
  type MetadataAccountData
} from "@metaplex-foundation/mpl-token-metadata";
import {
  address,
  createSolanaRpc,
  fetchEncodedAccount,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type GetAccountInfoApi,
  type GetSlotApi,
  type Rpc
} from "@solana/kit";

const TOKEN_METADATA_PROGRAM = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const NON_FUNGIBLE_TOKEN_STANDARDS = new Set([0, 4]);

export interface RawAccount {
  data: Uint8Array;
  owner: string;
}

export interface FinalizedAccountReader {
  getAccount(accountAddress: string): Promise<RawAccount | null>;
  getFinalizedSlot(): Promise<bigint>;
}

export interface MetadataEvidence {
  mint: string;
  metadataAddress: string;
  metadataUri: string;
  updateAuthority: string;
  collection: { key: string; verified: boolean } | null;
  immutable: boolean;
  nonFungible: boolean;
  collectionNft: boolean;
  accountHash: string;
}

export interface AuthorityProofEvidence {
  path: "metadata_update_authority" | "collection_authority";
  publishingTopology: "standalone_app_collection" | "publisher_collection";
  wallet: string;
  appMint: string;
  publisherCollectionMint: string | null;
  finalizedSlot: bigint;
  appMetadata: MetadataEvidence;
  publisherMetadata: MetadataEvidence | null;
  collectionAuthorityRecordHash?: string;
}

export class FinalizedMetadataVerifier {
  public constructor(private readonly accounts: FinalizedAccountReader) {}

  public async readMetadata(mint: string): Promise<MetadataEvidence> {
    const metadataAddress = await deriveMetadataAddress(mint);
    const account = await this.accounts.getAccount(metadataAddress);
    if (!account || account.owner !== TOKEN_METADATA_PROGRAM) throw new Error("TOKEN_METADATA_ACCOUNT_MISSING");
    const [metadata] = getMetadataAccountDataSerializer().deserialize(account.data);
    if (metadata.mint !== mint) throw new Error("TOKEN_METADATA_MINT_MISMATCH");
    return mapMetadata(metadata, metadataAddress, account.data);
  }

  public async verifyAppAuthority(input: {
    wallet: string;
    appMint: string;
  }): Promise<AuthorityProofEvidence> {
    const appMetadata = await this.readMetadata(input.appMint);
    if (!appMetadata.nonFungible || !appMetadata.collectionNft) {
      throw new Error("APP_MUST_BE_COLLECTION_NFT");
    }
    if (appMetadata.collection !== null && appMetadata.collection.verified !== true) {
      throw new Error("APP_PUBLISHER_COLLECTION_NOT_VERIFIED");
    }
    const publisherCollectionMint = appMetadata.collection?.key ?? null;
    const publisherMetadata = publisherCollectionMint === null
      ? null
      : await this.readMetadata(publisherCollectionMint);
    if (publisherMetadata !== null && (!publisherMetadata.nonFungible || !publisherMetadata.collectionNft)) {
      throw new Error("INVALID_PUBLISHER_COLLECTION_TOKEN_STANDARD");
    }
    const publishingTopology = publisherMetadata === null
      ? "standalone_app_collection" as const
      : "publisher_collection" as const;

    const finalizedSlot = await this.accounts.getFinalizedSlot();
    if (appMetadata.updateAuthority === input.wallet) {
      return {
        path: "metadata_update_authority",
        publishingTopology,
        wallet: input.wallet,
        appMint: input.appMint,
        publisherCollectionMint,
        finalizedSlot,
        appMetadata,
        publisherMetadata
      };
    }

    const recordAddress = await deriveCollectionAuthorityRecordAddress(input.appMint, input.wallet);
    const record = await this.accounts.getAccount(recordAddress);
    if (!record || record.owner !== TOKEN_METADATA_PROGRAM) throw new Error("WALLET_NOT_APP_AUTHORITY");
    getCollectionAuthorityRecordAccountDataSerializer().deserialize(record.data);

    return {
      path: "collection_authority",
      publishingTopology,
      wallet: input.wallet,
      appMint: input.appMint,
      publisherCollectionMint,
      finalizedSlot,
      appMetadata,
      publisherMetadata,
      collectionAuthorityRecordHash: hashBytes(record.data)
    };
  }

  public async verifyRelease(releaseMint: string, appMint: string): Promise<{ evidence: MetadataEvidence; finalizedSlot: bigint }> {
    const evidence = await this.readMetadata(releaseMint);
    if (!evidence.nonFungible || evidence.immutable !== true) throw new Error("RELEASE_MUST_BE_IMMUTABLE_NFT");
    if (evidence.collection?.key !== appMint || evidence.collection.verified !== true) {
      throw new Error("RELEASE_APP_COLLECTION_NOT_VERIFIED");
    }
    return { evidence, finalizedSlot: await this.accounts.getFinalizedSlot() };
  }
}

export class HeliusFinalizedAccountReader implements FinalizedAccountReader {
  public constructor(private readonly rpc: Rpc<GetAccountInfoApi & GetSlotApi>) {}

  public async getAccount(accountAddress: string): Promise<RawAccount | null> {
    const account = await fetchEncodedAccount(this.rpc, address(accountAddress), { commitment: "finalized" });
    if (!account.exists) return null;
    return { data: Uint8Array.from(account.data), owner: account.programAddress };
  }

  public async getFinalizedSlot(): Promise<bigint> {
    return this.rpc.getSlot({ commitment: "finalized" }).send();
  }
}

export function createHeliusFinalizedAccountReader(apiKey: string): HeliusFinalizedAccountReader {
  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
  return new HeliusFinalizedAccountReader(createSolanaRpc(endpoint));
}

export async function deriveMetadataAddress(mint: string): Promise<string> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: ["metadata", getAddressEncoder().encode(TOKEN_METADATA_PROGRAM), getAddressEncoder().encode(address(mint))]
  });
  return pda;
}

export async function deriveCollectionAuthorityRecordAddress(mint: string, wallet: string): Promise<string> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: [
      "metadata",
      getAddressEncoder().encode(TOKEN_METADATA_PROGRAM),
      getAddressEncoder().encode(address(mint)),
      "collection_authority",
      getAddressEncoder().encode(address(wallet))
    ]
  });
  return pda;
}

function mapMetadata(metadata: MetadataAccountData, metadataAddress: string, raw: Uint8Array): MetadataEvidence {
  const collection = unwrapOption(metadata.collection);
  const tokenStandard = unwrapOption(metadata.tokenStandard);
  return {
    mint: metadata.mint,
    metadataAddress,
    metadataUri: metadata.uri.replaceAll("\0", "").trim(),
    updateAuthority: metadata.updateAuthority,
    collection: collection === null ? null : { key: collection.key, verified: collection.verified },
    immutable: !metadata.isMutable,
    nonFungible: tokenStandard !== null && NON_FUNGIBLE_TOKEN_STANDARDS.has(tokenStandard),
    collectionNft: unwrapOption(metadata.collectionDetails) !== null,
    accountHash: hashBytes(raw)
  };
}

function unwrapOption<T>(option: { __option: "Some"; value: T } | { __option: "None" }): T | null {
  return option.__option === "Some" ? option.value : null;
}

function hashBytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

void (TOKEN_METADATA_PROGRAM satisfies Address);
