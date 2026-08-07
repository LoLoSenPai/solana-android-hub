# ADR-010 — Evidence gate for broad package visibility

## Decision

V1 does not request `QUERY_ALL_PACKAGES`. The supported strategy is local Hub installation records, targeted package inspection, exact development fixture queries, explicit `visibility_unknown`, and normalized PackageInstaller conflict results.

Broad visibility may be proposed only in a replacement ADR containing:

1. reproducible failures across a named device/OEM/API matrix;
2. evidence that a core install or update cannot complete safely;
3. alternatives tested, including targeted queries and PackageInstaller conflict handling;
4. privacy impact and installed-inventory handling;
5. the minimum scope and a rollback plan.

The API 36 emulator vertical slice completed v1 installation and the same-signer v2 update without broad visibility, so no such evidence currently exists.
