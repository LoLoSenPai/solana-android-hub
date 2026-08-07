# Server APK validator boundary

External production publication is fail-closed behind the ephemeral GitHub Actions validator.

## Protocol

1. An authenticated publisher publication request creates an immutable binary validation run from the Release row.
2. The backend dispatches `.github/workflows/apk-validator.yml` with only the correlation ID and canonical Hub origin.
3. The workflow obtains a GitHub OIDC token for audience `solana-android-hub-apk-validator`.
4. The backend verifies issuer, audience, repository, workflow reference, event type, and run identity before returning the manifest.
5. The runner downloads the APK into a fresh temporary directory. Every redirect is re-resolved and rejected if any address is private, local, link-local, multicast, reserved, or documentation-only.
6. The runner enforces redirect, timeout, and byte limits; verifies exact size/SHA; runs `apksigner`; and inspects package, version, minSdk, certificate, and permissions.
7. The signed result callback is compared to the stored manifest again. Its GitHub run/attempt replay key can be consumed only once.
8. Success changes only `validation_status` to `server_binary_valid`. Publication remains a separate authorized database transition.
9. The temporary APK and result files are removed regardless of outcome; workflows do not upload APK artifacts.

Production configuration refuses to start without `server_and_device`, a GitHub repository, and a dispatch credential. Local allowlisted `development_preview` records cannot satisfy this production gate.
