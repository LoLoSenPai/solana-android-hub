# Trust model

Dapport deliberately answers four different questions:

| Fact | Proof authority | Revocation |
| --- | --- | --- |
| Publisher controls app | Finalized App NFT update/delegated collection authority | On-chain authority change |
| Release/APK authentic | Verified App collection, official metadata schema, server and device APK checks | Validation failure or quarantine |
| Distribution consent active | Canonical off-chain publisher signature | Publisher revocation or authority loss |
| Solana Mobile approved | Independent approval provider/admin evidence | Approval provider/admin |

No downstream layer may replace these with a generic `verified` property.

The App and Release NFTs do not expose the Solana Mobile Publisher Portal review state. A Release NFT is already minted while the portal still shows `In Review`, and its public DAS/raw-account shape does not change when the portal later shows `Live`.

Dapport verifies consumer-store inclusion separately against Solana Mobile's Seeker catalogue GraphQL. Only the minimal `androidPackage` and visible `lastRelease.androidDetails.versionCode` fields are read from the catalogue feed; no official-store descriptions, images, or other app content are copied. A matching package and version becomes `verified_approved`. A package returned by the detail-only `dAppByAndroidPackage` resolver is not sufficient: testing showed that resolver can expose a portal-side `Live` record before the app appears in the consumer catalogue. Network or GraphQL failures preserve the previous status, and absence never becomes `rejected`.

This evidence enables the `approved` channel. The `trusted` channel remains based on publisher opt-in plus Dapport's own release checks and can therefore expose a newer release whose Solana Mobile inclusion is not yet verified.

Current publications use `App collection NFT → Release NFT`. A verified Publisher collection parent is accepted for legacy publications but is not synthesized or required when the official portal emits a standalone App collection NFT.
