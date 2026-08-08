-- STAGING ONLY / NON-PROMOTABLE.
--
-- This file is intentionally excluded from supabase/config.toml. It must never
-- run during a local reset or against a production database. Before applying it
-- manually, the operator must explicitly opt in for the current SQL session:
--
--   set hub.seed_environment = 'staging';
--
-- The catalogue entry represents a deterministic development preview. It is
-- not evidence of a real publisher signature, an on-chain claim, Solana Mobile
-- approval, or server-side APK validation.

begin;

do $$
begin
  if current_setting('hub.seed_environment', true) is distinct from 'staging' then
    raise exception 'Refusing staging fixture: set hub.seed_environment = staging for this SQL session first';
  end if;

  if exists (
    select 1
    from hub.distribution_consents
    where environment = 'production'
  ) then
    raise exception 'Refusing staging fixture: this database contains production consent data';
  end if;
end
$$;

insert into hub.publishers (id, display_name, status)
values (
  '30000000-0000-4000-8000-000000000001',
  'Hub Staging Fixture Publisher',
  'active'
)
on conflict (id) do update set
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = now();

insert into hub.publisher_wallets (id, publisher_id, wallet_address)
values (
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  '66666666666666666666666666666666'
)
on conflict (id) do update set
  publisher_id = excluded.publisher_id,
  wallet_address = excluded.wallet_address,
  verified_at = now();

insert into hub.apps (
  id,
  publisher_id,
  app_mint,
  publisher_collection_mint,
  package_name,
  slug,
  name,
  short_description,
  description,
  metadata_uri,
  source_snapshot,
  source_snapshot_hash,
  claim_status,
  release_policy,
  distribution_enabled,
  authority_path,
  authority_address,
  authority_last_verified_slot,
  authority_last_verified_at
) values (
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000001',
  '22222222222222222222222222222222',
  '33333333333333333333333333333333',
  'com.lololabs.hubfixture',
  'hub-install-demo',
  'Hub Install Demo',
  'A staging-only Android installation preview.',
  'This non-promotable fixture proves the Hub catalogue, secure APK validation, and Android installation path with a real test APK.',
  'https://fixtures.invalid/staging/app-v1.json',
  '{"environment":"staging","fixture":true,"nonPromotable":true,"appMetadata":{"properties":{"category":"games"}}}'::jsonb,
  repeat('5', 64),
  'verified',
  'automatic',
  true,
  'update_authority',
  '66666666666666666666666666666666',
  1,
  now()
)
on conflict (id) do update set
  publisher_id = excluded.publisher_id,
  app_mint = excluded.app_mint,
  publisher_collection_mint = excluded.publisher_collection_mint,
  package_name = excluded.package_name,
  slug = excluded.slug,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  metadata_uri = excluded.metadata_uri,
  source_snapshot = excluded.source_snapshot,
  source_snapshot_hash = excluded.source_snapshot_hash,
  claim_status = excluded.claim_status,
  release_policy = excluded.release_policy,
  distribution_enabled = excluded.distribution_enabled,
  authority_path = excluded.authority_path,
  authority_address = excluded.authority_address,
  authority_last_verified_slot = excluded.authority_last_verified_slot,
  authority_last_verified_at = excluded.authority_last_verified_at,
  suspended_at = null,
  suspension_reason = null,
  revoked_at = null,
  updated_at = now();

insert into hub.app_claims (
  id,
  app_id,
  publisher_wallet_id,
  status,
  authority_path,
  finalized_slot,
  evidence_hash,
  evidence_snapshot,
  verified_at
) values (
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000002',
  'verified',
  'update_authority',
  1,
  repeat('6', 64),
  '{"environment":"staging","fixture":true,"nonPromotable":true,"authorityProvider":"deterministic_fixture"}'::jsonb,
  now()
)
on conflict (id) do update set
  app_id = excluded.app_id,
  publisher_wallet_id = excluded.publisher_wallet_id,
  status = excluded.status,
  authority_path = excluded.authority_path,
  finalized_slot = excluded.finalized_slot,
  evidence_hash = excluded.evidence_hash,
  evidence_snapshot = excluded.evidence_snapshot,
  verified_at = excluded.verified_at,
  superseded_at = null;

insert into hub.distribution_consents (
  id,
  app_id,
  publisher_wallet_id,
  environment,
  status,
  message,
  signature,
  nonce_hash,
  scopes,
  release_policy,
  terms_version,
  issued_at,
  signing_expires_at,
  verified_at
) values (
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000002',
  'staging',
  'active',
  'STAGING FIXTURE CONSENT - NON-PROMOTABLE',
  'fixture-signature-not-publisher-consent',
  decode(repeat('cd', 32), 'hex'),
  array[
    'facilitate_apk_installation',
    'list_app',
    'monitor_future_releases',
    'use_public_metadata'
  ],
  'automatic',
  'staging-2026-08-08',
  now() - interval '1 minute',
  now() + interval '9 minutes',
  now()
)
on conflict (id) do update set
  app_id = excluded.app_id,
  publisher_wallet_id = excluded.publisher_wallet_id,
  environment = excluded.environment,
  status = excluded.status,
  message = excluded.message,
  signature = excluded.signature,
  nonce_hash = excluded.nonce_hash,
  scopes = excluded.scopes,
  release_policy = excluded.release_policy,
  terms_version = excluded.terms_version,
  issued_at = excluded.issued_at,
  signing_expires_at = excluded.signing_expires_at,
  verified_at = excluded.verified_at,
  revoked_at = null,
  revocation_reason = null,
  superseded_at = null;

insert into hub.releases (
  id,
  app_id,
  release_mint,
  metadata_uri,
  source_snapshot,
  source_snapshot_hash,
  package_name,
  version_name,
  version_code,
  apk_uri,
  apk_size,
  apk_sha256,
  certificate_sha256,
  min_sdk,
  target_sdk,
  permissions,
  locales,
  collection_verified,
  metadata_immutable,
  validation_status,
  publication_status,
  discovered_slot,
  validated_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003',
  '44444444444444444444444444444444',
  'https://fixtures.invalid/staging/release-v1.json',
  '{"environment":"staging","fixture":true,"version":1,"nonPromotable":true,"releaseMetadata":{"properties":{"category":"games"}}}'::jsonb,
  repeat('7', 64),
  'com.lololabs.hubfixture',
  '1.0.0',
  1,
  'https://fixture-host.vercel.app/v1.apk',
  644034,
  '8e50cee640062ba1bfcfb7c3bcae7afbf33dd803e4c26219a132387b8ebf5160',
  'ad3ab6f4878a16a91ccc0572d3a96248cf2c50ad195187209dcc9a7814c716ef',
  26,
  36,
  array['android.permission.INTERNET'],
  array['en-US'],
  true,
  true,
  'metadata_valid',
  'preview',
  1,
  now()
)
on conflict (id) do update set
  app_id = excluded.app_id,
  release_mint = excluded.release_mint,
  metadata_uri = excluded.metadata_uri,
  source_snapshot = excluded.source_snapshot,
  source_snapshot_hash = excluded.source_snapshot_hash,
  package_name = excluded.package_name,
  version_name = excluded.version_name,
  version_code = excluded.version_code,
  apk_uri = excluded.apk_uri,
  apk_size = excluded.apk_size,
  apk_sha256 = excluded.apk_sha256,
  certificate_sha256 = excluded.certificate_sha256,
  min_sdk = excluded.min_sdk,
  target_sdk = excluded.target_sdk,
  permissions = excluded.permissions,
  locales = excluded.locales,
  collection_verified = excluded.collection_verified,
  metadata_immutable = excluded.metadata_immutable,
  validation_status = excluded.validation_status,
  publication_status = excluded.publication_status,
  quarantine_code = null,
  quarantine_detail = null,
  discovered_slot = excluded.discovered_slot,
  validated_at = excluded.validated_at,
  published_at = null,
  updated_at = now();

insert into hub.release_validation_runs (
  id,
  release_id,
  stage,
  provider,
  status,
  expected,
  observed,
  failure_codes,
  completed_at
) values (
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  'metadata',
  'staging_fixture_manifest',
  'succeeded',
  '{"sha256":"8e50cee640062ba1bfcfb7c3bcae7afbf33dd803e4c26219a132387b8ebf5160","packageName":"com.lololabs.hubfixture","versionCode":1}'::jsonb,
  '{"fixture":true,"nonPromotable":true,"serverBinaryValidated":false}'::jsonb,
  '{}',
  now()
)
on conflict (id) do update set
  release_id = excluded.release_id,
  stage = excluded.stage,
  provider = excluded.provider,
  status = excluded.status,
  expected = excluded.expected,
  observed = excluded.observed,
  failure_codes = excluded.failure_codes,
  completed_at = excluded.completed_at;

do $$
begin
  if not exists (
    select 1
    from hub.apps a
    join hub.distribution_consents dc on dc.app_id = a.id
    join hub.releases r on r.app_id = a.id
    where a.id = '30000000-0000-4000-8000-000000000003'
      and a.app_mint = '22222222222222222222222222222222'
      and a.source_snapshot #>> '{appMetadata,properties,category}' = 'games'
      and a.claim_status = 'verified'
      and a.distribution_enabled = true
      and dc.environment = 'staging'
      and dc.status = 'active'
      and dc.terms_version = 'staging-2026-08-08'
      and r.id = '40000000-0000-4000-8000-000000000001'
      and r.apk_uri = 'https://fixture-host.vercel.app/v1.apk'
      and r.validation_status = 'metadata_valid'
      and r.publication_status = 'preview'
  ) then
    raise exception 'Staging fixture verification failed';
  end if;
end
$$;

commit;
