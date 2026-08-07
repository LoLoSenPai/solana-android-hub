# ADR-007 — Least-privileged PackageInstaller architecture

## Decision

Ship one standalone APK without `QUERY_ALL_PACKAGES`. Track Hub installations locally, make targeted package queries, keep visibility uncertainty explicit, and use PackageInstaller conflict results when preflight inspection is unavailable.

The Kotlin module downloads and validates the actual APK, returns only opaque prepared IDs, and uses supported PackageInstaller sessions with user confirmation.

## Reason

Broad installed-app visibility is privacy-sensitive and is not yet proven necessary for the core distribution loop.

## Alternatives rejected

- `QUERY_ALL_PACKAGES` by default.
- Shell/ADB installation in production.
- Passing an arbitrary file path from JavaScript to an installer method.
- Maintaining a Play-specific product flavor in V1.

## Consequences

`visibility_unknown` is a first-class state. Android provides final signer/version conflict enforcement. Adding broad visibility requires a new ADR with reproducible API/OEM failures and alternatives tested.
