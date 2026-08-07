# Deployment and launch gates

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

## Production startup requirements

Configuration validation refuses production startup unless all of the following are present:

- final HTTPS `HUB_ORIGIN`;
- `RELEASE_PUBLICATION_GATE=server_and_device`;
- non-development `CONSENT_TERMS_VERSION`;
- database, Helius, session-pepper, cron, admin-wallet, GitHub repository, and validator dispatch configuration.

Before public launch, additionally complete production signing, legal/terms/privacy/takedown review, backups and restore rehearsal, alerting, incident ownership, physical-device install/update validation, and an Android developer-registration reassessment. These items do not block local implementation.

No real production publisher consent may be collected before the canonical origin and exact production consent terms are final.
