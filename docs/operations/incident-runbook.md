# Incident runbook

## Suspected publisher-authority loss

1. Suspend the App and withdraw preview/published Releases.
2. Preserve finalized account slot/hash evidence and the append-only audit entry.
3. Reverify the App collection NFT and current update/delegated authority. If a legacy Publisher parent is present, reverify that relationship too.
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

## Publication monitoring

To check the immediate dispatch path, send an authenticated `POST` to `https://dapport.app/api/v1/internal/cron/sync` with the production cron bearer credential and JSON body `{"operation":"wake_apk_dispatcher"}`. The HTTP 202 response carries the request ID. Find it in the title of **Dispatch queued APK validations** on GitHub, verify the run succeeded on `main` under the Dapport GitHub App bot and check its log for the number of reserved APK validations. A zero count verifies authentication and queue access. If it reserves a release, follow its correlation ID through the validator and check the catalogue version. The scheduled poll also runs when the immediate wake-up fails.

**Dapport publication health** runs at minutes `13` and `43` UTC and can be run manually from the Actions tab on `main`. It reads production health through a dedicated GitHub OIDC identity. Actions shows issue codes and counts. The [Dapport admin page](https://dapport.app/admin) shows affected apps and validation IDs. To receive failed-run notifications, enable GitHub Actions notifications for the account responsible for the schedule and confirm who receives them when the schedule is changed or re-enabled. [GitHub workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)

- `VALIDATOR_DISPATCH_HTTP_401` or `VALIDATOR_DISPATCH_FAILED` — check dispatch configuration and permissions. Use the app slug, APK version and validation ID from the failure to find the affected attempt.
- `VALIDATOR_OVERDUE`, `VALIDATOR_TIMEOUT`, `VALIDATOR_RUNNER_FAILED`, `MANIFEST_INVALID` or `VALIDATOR_NOT_STARTED` — check the dispatcher and validator runs, their logs and the callback. The monitor gives active validations 45 minutes and a new automatic release an hour to start validation. After a timeout, the alert stays active while the replacement is queued.
- `AUTOMATIC_PUBLICATION_PENDING` — the newest APK passed server validation but is still unpublished under the automatic policy. Inspect the publication transition and current consent.
- `SCHEDULED_SYNC_OVERDUE` or `RELEASE_SYNC_FAILED` — check the Vercel sync logs and the job history for the app. The monitor allows two hours for scheduled synchronization and sustained failures.
- `PUBLICATION_MONITOR_AUTH_REJECTED`, `PUBLICATION_MONITOR_WRONG_ENVIRONMENT` or `PUBLICATION_MONITOR_READ_FAILED` — check the production deployment, repository configuration and database connectivity. Use the request ID to correlate the check with production logs.

After resolving a failure, run **Dapport publication health** again on `main` to verify recovery. An APK awaiting a manual publishing decision, expected validation refusals and older releases superseded by a newer publication stay out of the alert.

## Consent revocation or takedown

- Revoke the environment-specific consent, disable distribution, and withdraw selected Releases transactionally.
- Existing device installations are never remotely uninstalled.
- Record legal/takedown references only in restricted operational evidence, not public DTOs.

## Database recovery

- Restore into an isolated project, verify migration version and constraints, then compare audit and validation-run counts.
- Confirm the private `hub` schema is not exposed through the Supabase Data API.
- Reverify authority and current Release eligibility before restoring catalogue traffic.
