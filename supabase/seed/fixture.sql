-- Local-only, non-promotable data for the real Android install/update slice.
insert into hub.publishers (id, display_name)
values ('10000000-0000-4000-8000-000000000001', 'Hub Fixture Publisher');

insert into hub.publisher_wallets (id, publisher_id, wallet_address)
values (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '66666666666666666666666666666666'
);

insert into hub.apps (
  id, publisher_id, app_mint, publisher_collection_mint, package_name, slug, name, short_description, description,
  metadata_uri, source_snapshot, source_snapshot_hash, claim_status, release_policy, distribution_enabled,
  authority_path, authority_address, authority_last_verified_slot, authority_last_verified_at
) values (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '22222222222222222222222222222222',
  '33333333333333333333333333333333',
  'com.lololabs.hubfixture',
  'hub-install-fixture',
  'Hub Install Fixture',
  'A measured APK used only for the local install/update slice.',
  'This internal app proves that the Hub downloads, validates, installs, detects, and updates a real monolithic APK.',
  'https://fixtures.invalid/app.json',
  '{"environment":"local","fixture":true,"nonPromotable":true}',
  repeat('1', 64),
  'verified',
  'automatic',
  true,
  'update_authority',
  '66666666666666666666666666666666',
  1,
  now()
);

insert into hub.app_classifications (app_id, primary_category, tags, source)
values (
  '10000000-0000-4000-8000-000000000003',
  'games',
  array['casual', 'puzzle'],
  'hub_curated'
);

insert into hub.app_claims (
  id, app_id, publisher_wallet_id, status, authority_path, finalized_slot, evidence_hash, evidence_snapshot, verified_at
) values (
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  'verified',
  'update_authority',
  1,
  repeat('2', 64),
  '{"environment":"local","fixture":true,"authorityProvider":"deterministic_fixture"}',
  now()
);

insert into hub.distribution_consents (
  id, app_id, publisher_wallet_id, environment, message, signature, nonce_hash, scopes, release_policy,
  terms_version, issued_at, signing_expires_at, verified_at
) values (
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  'local',
  'LOCAL FIXTURE CONSENT — NON-PROMOTABLE',
  'fixture-signature-not-production-consent',
  decode(repeat('ab', 32), 'hex'),
  array['facilitate_apk_installation','list_app','monitor_future_releases','use_public_metadata'],
  'automatic',
  'dev-1',
  now() - interval '1 minute',
  now() + interval '9 minutes',
  now()
);

insert into hub.releases (
  id, app_id, release_mint, metadata_uri, source_snapshot, source_snapshot_hash, package_name, version_name,
  version_code, apk_uri, apk_size, apk_sha256, certificate_sha256, min_sdk, target_sdk, permissions, locales,
  collection_verified, metadata_immutable, validation_status, publication_status, discovered_slot, validated_at
) values
(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '44444444444444444444444444444444',
  'https://fixtures.invalid/release-v1.json',
  '{"environment":"local","fixture":true,"version":1,"nonPromotable":true}',
  repeat('3', 64),
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
),
(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '55555555555555555555555555555555',
  'https://fixtures.invalid/release-v2.json',
  '{"environment":"local","fixture":true,"version":2,"nonPromotable":true}',
  repeat('4', 64),
  'com.lololabs.hubfixture',
  '2.0.0',
  2,
  'https://fixture-host.vercel.app/v2.apk',
  644034,
  '5c88eeb5b4eace009f859058c4c5fadfeb3f1695c78a135e48f3a53d2afb4653',
  'ad3ab6f4878a16a91ccc0572d3a96248cf2c50ad195187209dcc9a7814c716ef',
  26,
  36,
  array['android.permission.INTERNET'],
  array['en-US'],
  true,
  true,
  'metadata_valid',
  'unpublished',
  2,
  now()
);

insert into hub.release_validation_runs (release_id, stage, provider, status, expected, observed, completed_at)
values
(
  '20000000-0000-4000-8000-000000000001', 'metadata', 'local_fixture_manifest', 'succeeded',
  '{"sha256":"8e50cee640062ba1bfcfb7c3bcae7afbf33dd803e4c26219a132387b8ebf5160"}',
  '{"apksignerVerified":true,"fixture":true}', now()
),
(
  '20000000-0000-4000-8000-000000000002', 'metadata', 'local_fixture_manifest', 'succeeded',
  '{"sha256":"5c88eeb5b4eace009f859058c4c5fadfeb3f1695c78a135e48f3a53d2afb4653"}',
  '{"apksignerVerified":true,"fixture":true}', now()
);
