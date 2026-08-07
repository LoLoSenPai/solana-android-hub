# Incident runbook

## Suspected publisher-authority loss

1. Suspend the App and withdraw preview/published Releases.
2. Preserve finalized account slot/hash evidence and the append-only audit entry.
3. Reverify App→Publisher collection and current update/delegated authority.
4. Do not unsuspend from cached DAS fields.

## APK mismatch or mutable host

1. Quarantine the Release and prevent publication/update selection.
2. Preserve expected/observed hashes, validator correlation, tool versions, redirect chain digest, and finalized metadata evidence.
3. Never redistribute or execute the suspect APK.
4. Require a new valid Release identity; do not rewrite immutable Release facts in place.

## Validator outage

- Leave releases metadata-valid/unpublished; production publication remains unavailable.
- Retry idempotently with a new GitHub run. A completed callback replay is rejected.
- Local allowlisted previews may continue only outside production and retain development labeling.

## Consent revocation or takedown

- Revoke the environment-specific consent, disable distribution, and withdraw selected Releases transactionally.
- Existing device installations are never remotely uninstalled.
- Record legal/takedown references only in restricted operational evidence, not public DTOs.

## Database recovery

- Restore into an isolated project, verify migration version and constraints, then compare audit and validation-run counts.
- Confirm the private `hub` schema is not exposed through the Supabase Data API.
- Reverify authority and current Release eligibility before restoring catalogue traffic.
