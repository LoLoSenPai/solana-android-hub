# ADR-005 — Helius discovery, finalized raw-account proof

## Decision

Use Helius DAS to discover candidate App and Release NFTs. Re-read and parse raw Metaplex accounts at finalized commitment for authority and verified collection proof.

The current Publisher Portal topology is a standalone App collection NFT with each immutable Release NFT verified into that App collection. Legacy publications may additionally place the App NFT in a verified Publisher collection. The parent Publisher collection is therefore optional evidence, never a requirement for a current portal App.

## Reason

DAS is an index with short latency; authorization requires authoritative current account data.

## Alternatives rejected

- DAS fields as final proof: indexed data is not an authorization boundary.
- Indexing the whole ecosystem: V1 only needs opted-in apps.

## Consequences

Adapters keep DAS candidate data separate from finalized proof evidence. Mainnet-free fixtures cover normal tests.

The App must itself be an uncompressed non-fungible collection. The connected wallet must be its current metadata update authority or a valid delegated App collection authority. A generic NFT, NFT ownership, creator arrays, and DAS authority fields remain insufficient.
