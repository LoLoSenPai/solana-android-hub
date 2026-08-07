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
