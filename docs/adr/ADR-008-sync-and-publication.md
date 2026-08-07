# ADR-008 — Poll opted-in apps and separate preview from production

## Decision

Poll only claimed apps using database leases. Local/staging may expose allowlisted metadata-valid releases as `development_preview`; production requires server and device binary validation.

## Reason

This proves the Android installation path early while preserving a hard production supply-chain gate.

## Alternatives rejected

- Whole-ecosystem indexing.
- Making GitHub Actions block the first device slice.
- Allowing preview configuration in production.

## Consequences

Production configuration fails at startup unless the server validation gate is active. Preview consent and releases cannot be promoted.
