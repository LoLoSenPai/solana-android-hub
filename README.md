# Dapport

A third-party, opt-in Android distribution platform for apps published through the public Solana Mobile publishing format.

The canonical public web and API origin is `https://dapport.app`. Local development deliberately keeps using the emulator/localhost values from `.env.example`; production builds use the fail-closed `.env.production.example` contract and the corresponding Vercel/EAS environment variables.

The project keeps four facts separate: publisher control, Release/APK authenticity, distribution consent, and independently verified Solana Mobile approval.

## Production publisher onboarding

Production onboarding is open at [dapport.app/publisher](https://dapport.app/publisher) for an initial group of external publishers. Dapport uses the App and Release NFTs that publishers already created through Solana Mobile; it does not ask them to create another NFT, upload another APK, or maintain a second release channel.

A publisher connects the wallet holding the current App NFT publishing authority and signs two plain-text messages: a short-lived authentication challenge, then a separate app-specific distribution consent. Neither message is a transaction, transfers an asset, or grants Dapport on-chain authority. Consent is bound to the production origin, App mint, release policy and current terms version, and it can be revoked or renewed by the publisher.

Every production release must pass the server-side APK validator before it can enter the catalogue. The Android app independently checks the downloaded APK again on the user's device before handing it to Android's system installer. Solana Mobile approval, when available, remains a separate status and is never implied by publisher consent or Dapport validation.

The APK runner reports preparation failures as `VALIDATOR_RUNNER_FAILED`. Validations with no response expire after 45 minutes, retain a `VALIDATOR_TIMEOUT` audit record, and can be retried with a new correlation ID. Scheduled synchronization retries eligible automatic releases; manual releases remain under publisher control. Retried callbacks are idempotent only for the same result and authenticated GitHub run.

CI runs validation lifecycle integration tests against disposable PostgreSQL 17 with all migrations applied. To run them locally, set `DATABASE_TEST_URL` to a disposable migrated database before running `pnpm --filter @hub/database test`.

## Publisher profiles

Publishers can edit their optional name, bio, avatar image URL, portfolio and social links in **My profile**. The public `/publishers/<slug>` page lists only their currently available catalogue apps, and each app page links back to its publisher. Sharing uses the device share sheet when available, with clipboard and manual-copy fallbacks. The publisher UUID remains a stable profile alias when a custom address changes.

Apply `supabase/migrations/20261010112114_add_publisher_profiles.sql` before deploying the updated web/API code. Profile editing uses the existing authenticated publisher session; visitors can read public profiles without connecting a wallet.

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

The production terms, Android signing, runtime secrets, admin wallet configuration, Helius verification and server validation gate are operational. Local and staging consent remains isolated and can never be promoted to production; consent created for a previous origin or brand is likewise never reused by Dapport production.

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
