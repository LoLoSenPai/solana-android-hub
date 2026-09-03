# ADR-006 — Four separate trust facts

## Decision

Model publisher control, APK/Release authenticity, consent, and Solana Mobile approval as independent fields and histories.

## Reason

Each fact has a different authority and revocation path. A generic verified flag would create unsafe policy shortcuts.

## Alternatives rejected

- One trust boolean or score.
- Allowing publishers to self-assign approval.

## Consequences

Approval never overrides authenticity or consent. Preview releases are not labeled verified publisher releases.

The Solana Mobile `In Review`/`Live` portal state is not present in App or Release NFT metadata. Dapport therefore never infers approval from NFT existence, Release immutability, or a publisher-controlled assertion.

For consumer-store inclusion, Dapport uses Solana Mobile's Seeker catalogue GraphQL as an `official_provider`. It reads only package names and visible release version codes from the catalogue discovery feed and discards entries that are not already publisher-consented Dapport apps. The detail resolver `dAppByAndroidPackage` is explicitly not accepted as proof because it can return portal-side records before they appear in the consumer catalogue. Provider failures preserve prior evidence; absence produces `unknown`, never `rejected`.

Dapport may use that detail resolver for a separate, non-trust purpose: fetching `rating.rating` and `rating.reviewsByRating` for an already consented package. The average and five review-count buckets are cached in the existing sync result as presentation metadata, are not tied to a release approval, and do not change catalogue eligibility. Review text and other official-store content are not copied. A failed rating lookup leaves the previous successful aggregate unchanged.
