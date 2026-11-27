# Server APK validator boundary

External production publication is fail-closed behind the ephemeral GitHub Actions validator.

## Protocol

1. An authenticated publisher publication request creates an immutable binary validation run from the Release row.
2. In production the backend uses a short-lived GitHub App installation token to wake `dispatch-apks.yml` on `main`. The dispatcher authenticates with OIDC, reserves eligible queue entries and uses its own repository token to start a separate `apk-validator.yml` workflow for each correlation ID and canonical Hub origin. Its scheduled poll also collects waiting requests.
3. The workflow obtains a GitHub OIDC token for audience `solana-android-hub-apk-validator`.
4. The backend verifies issuer, audience, repository, workflow reference, event type, and run identity before returning the manifest.
5. The runner downloads the APK into a fresh temporary directory. Every redirect is re-resolved and rejected if any address is private, local, link-local, multicast, reserved, or documentation-only.
6. The runner enforces redirect, timeout, and byte limits; verifies exact size/SHA; runs `apksigner`; and inspects package, version, minSdk, certificate, and permissions.
7. The signed result callback is compared to the stored manifest again. Its GitHub run/attempt replay key can be consumed only once.
8. Success changes only `validation_status` to `server_binary_valid`. Publication remains a separate authorized database transition.
9. The temporary APK and result files are removed regardless of outcome; workflows do not upload APK artifacts.

Production requires `server_and_device` and a GitHub repository. If the GitHub App credential is unavailable, requests remain queued for the scheduled dispatcher. Local allowlisted `development_preview` records cannot satisfy the production publication gate.
