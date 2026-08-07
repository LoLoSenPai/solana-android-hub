# Trust model

The Hub deliberately answers four different questions:

| Fact | Proof authority | Revocation |
| --- | --- | --- |
| Publisher controls app | Finalized Metaplex update/delegated collection authority | On-chain authority change |
| Release/APK authentic | Verified App collection, official metadata schema, server and device APK checks | Validation failure or quarantine |
| Distribution consent active | Canonical off-chain publisher signature | Publisher revocation or authority loss |
| Solana Mobile approved | Independent approval provider/admin evidence | Approval provider/admin |

No downstream layer may replace these with a generic `verified` property.
