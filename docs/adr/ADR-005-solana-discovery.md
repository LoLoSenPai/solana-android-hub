# ADR-005 — Helius discovery, finalized raw-account proof

## Decision

Use Helius DAS to discover candidate App and Release NFTs. Re-read and parse raw Metaplex accounts at finalized commitment for authority and verified collection proof.

## Reason

DAS is an index with short latency; authorization requires authoritative current account data.

## Alternatives rejected

- DAS fields as final proof: indexed data is not an authorization boundary.
- Indexing the whole ecosystem: V1 only needs opted-in apps.

## Consequences

Adapters keep DAS candidate data separate from finalized proof evidence. Mainnet-free fixtures cover normal tests.
