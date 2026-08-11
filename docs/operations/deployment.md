# Deployment and launch gates

## Canonical origin

- Canonical public web/API origin: `https://dapport.app`.
- Configure both `HUB_ORIGIN` and `EXPO_PUBLIC_HUB_ORIGIN` to that exact HTTPS origin for production web and Android builds.
- Configure the legacy `solana-hub.lololabs.xyz` Vercel domain as a permanent
  redirect to `https://dapport.app`; never serve consent challenges from both origins.
- The domain may host a visibly labeled staging showcase before launch, but that does not make staging consent promotable or open production publisher onboarding.
- `.env.production.example` intentionally contains a blocked development terms version and blank secrets so an incomplete production configuration fails closed.

## Local

- Start local Supabase with `pnpm supabase start`, then reset with `pnpm supabase db reset`.
- Use `.env.example` placeholders and `APP_ENV=local`.
- `device_only_preview` is allowed only for `ALLOWED_PREVIEW_APP_MINTS`.
- Fixture APKs are public, non-production binaries hosted by the dedicated Vercel fixture project.
- Local/staging signatures and consent records are never promotable.

## Staging

- Create dedicated Supabase and Vercel projects; do not reuse unrelated connector projects.
- Configure an HTTPS `HUB_ORIGIN`, staging terms, staging signing, a Helius key, an admin allowlist, and GitHub validator dispatch.
- Keep real App mints allowlisted while `device_only_preview` is in use.
- Exercise the GitHub OIDC callback against the deployed origin before any external publisher is onboarded.
- Vercel invokes `/api/v1/internal/cron/sync` every 15 minutes in the production deployment target. The route accepts Vercel's authenticated `GET` request and retains authenticated `POST` for manual operational runs; both require `CRON_SECRET`.

## Production startup requirements

Configuration validation refuses production startup unless all of the following are present:

- final HTTPS `HUB_ORIGIN`;
- `RELEASE_PUBLICATION_GATE=server_and_device`;
- non-development `CONSENT_TERMS_VERSION`;
- database, Helius, session-pepper, cron, admin-wallet, GitHub repository, and validator dispatch configuration.

Before public launch, additionally complete production signing, legal/terms/privacy/takedown review, backups and restore rehearsal, alerting, incident ownership, physical-device install/update validation, and an Android developer-registration reassessment. These items do not block local implementation.

No real production publisher consent may be collected before the canonical origin and exact production consent terms are final.
