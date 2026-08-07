# Solana Android Hub

An independent, opt-in Android distribution hub for apps published through the public Solana Mobile publishing format.

The project keeps four facts separate: publisher control, Release/APK authenticity, distribution consent, and independently verified Solana Mobile approval.

## Development

Requirements: Node.js 22.13+, pnpm 10.26.2, JDK 17, and Android SDK 36.

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env.local
pnpm check
```

Start the private local database and web policy boundary:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset
pnpm --filter @hub/web dev
```

The Supabase Data API is disabled. The browser and Android app call the Next.js API; only the backend role can access the private `hub` schema.

Generate and verify the single standalone Android project:

```powershell
pnpm --filter @hub/mobile prebuild
Set-Location apps/mobile/android
.\gradlew.bat :hub-app-installer:testDebugUnitTest :app:assembleDebug
```

The checked-in v1/v2 and negative APK fixtures live in `fixtures/apks/hub-test-app/artifacts`. Their immutable hashes, package, versions, permissions, and signer fingerprints are recorded in the adjacent manifest. A completed API 36 install/update run is documented in [docs/testing/android-vertical-slice.md](docs/testing/android-vertical-slice.md).

Local and staging builds may expose explicitly allowlisted releases as `development_preview`. Production refuses preview mode and requires both server-side and on-device APK validation.

## Publication boundary

- `device_only_preview` is accepted only for local/staging, only for allowlisted App mints, and is never promotable.
- `server_and_device` is mandatory in production; GitHub OIDC-authenticated validation must succeed before publication.
- Production additionally requires final HTTPS origin, non-development terms, production secrets, admin wallets, and a Helius key.
- Android developer registration remains an extension point and has no V1 database workflow or UI.

## Security invariants

- No `QUERY_ALL_PACKAGES` permission.
- No APK is installed before SHA-256, package, version, and signing-certificate validation.
- No external production release is published before server-side APK validation.
- Browser and mobile clients never receive Supabase or Helius secrets.
- No publisher can self-assign Solana Mobile approval.
- Package visibility is targeted to the fixed internal fixture; unknown installed editions remain explicit and rely on PackageInstaller conflict handling.
