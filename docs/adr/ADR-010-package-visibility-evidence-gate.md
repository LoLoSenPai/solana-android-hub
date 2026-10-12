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

## Scoped launcher visibility — 2026-10-12

The production Seeker on API 36 exposed a separate installed-state failure: PrivacySafe `app.privacysafe` version 12610006 installed successfully through Dapport, but `getInstalledPackageInfo` returned `visibility_unknown`. The library displayed `State unavailable`; the app detail offered another installation. The catalogue card's `Installed` label came from the local installation record, not current Android evidence.

Allow visibility of apps matching the exact `android.intent.action.MAIN` + `android.intent.category.LAUNCHER` signature. This supports inspecting and opening catalogue apps with launcher activities. It does not request `QUERY_ALL_PACKAGES`, wildcard intents or visibility of every installed package. Dapport continues to inspect individual package names supplied by its catalogue or local installation records; it does not enumerate or upload installed applications. The declaration makes launcher apps eligible for those targeted inspections, including apps outside the catalogue, but the implementation never queries that wider set.

Local records alone cannot detect an external update or uninstall. The previous fixed fixture declaration only supports the test package. Adding one declaration per publisher would require a new Dapport binary whenever a new package is listed. Android's PackageInstaller conflict handling remains the final installation safeguard, but cannot supply the installed version needed for the Open/Update button. The scoped launcher signature addresses that runtime need while retaining `visibility_unknown` for packages Android still filters.

Rollback consists of removing the launcher intent from the module manifest; the explicit unknown-state path and installation conflict handling remain. Physical confirmation for this change is recorded in `docs/testing/android-vertical-slice.md`; the named target is Seeker/API 36, and other OEM/API combinations remain unverified.

References: [Android visibility declarations](https://developer.android.com/training/package-visibility/declaring) and [automatically visible packages](https://developer.android.com/training/package-visibility/automatic). The gate above still applies to any future request for all-package visibility.
