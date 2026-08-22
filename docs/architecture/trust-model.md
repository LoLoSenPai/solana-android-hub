# Trust model

Dapport deliberately answers four different questions:

| Fact | Proof authority | Revocation |
| --- | --- | --- |
| Publisher controls app | Finalized App NFT update/delegated collection authority | On-chain authority change |
| Release/APK authentic | Verified App collection, official metadata schema, server and device APK checks | Validation failure or quarantine |
| Distribution consent active | Canonical off-chain publisher signature | Publisher revocation or authority loss |
| Solana Mobile approved | Independent approval provider/admin evidence | Approval provider/admin |

No downstream layer may replace these with a generic `verified` property.

The App and Release NFTs do not expose the Solana Mobile Publisher Portal review state. A Release NFT is already minted while the portal still shows `In Review`, and its public DAS/raw-account shape does not change when the portal later shows `Live`. Until Solana Mobile exposes a documented, independently verifiable approval source, Dapport keeps this fact as `unknown` and does not offer an “approved only” consumer filter. Dapport publication is based on publisher opt-in plus Dapport's own release checks, not on an inferred portal status.

Current publications use `App collection NFT → Release NFT`. A verified Publisher collection parent is accepted for legacy publications but is not synthesized or required when the official portal emits a standalone App collection NFT.
