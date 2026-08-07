create schema if not exists hub;

revoke all on schema hub from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hub_backend') then
    create role hub_backend nologin noinherit nobypassrls;
  end if;
end
$$;

grant usage on schema hub to hub_backend;

create type hub.app_environment as enum ('local', 'staging', 'production');
create type hub.publisher_status as enum ('active', 'suspended', 'revoked');
create type hub.claim_status as enum ('pending', 'verified', 'suspended', 'revoked');
create type hub.authority_path as enum ('update_authority', 'delegated_collection_authority');
create type hub.release_policy as enum ('automatic', 'manual');
create type hub.consent_status as enum ('active', 'revoked', 'superseded');
create type hub.release_validation_status as enum ('discovered', 'metadata_valid', 'validating_binary', 'server_binary_valid', 'quarantined');
create type hub.publication_status as enum ('preview', 'unpublished', 'published', 'ignored', 'withdrawn');
create type hub.approval_status as enum ('unknown', 'verified_approved', 'rejected');
create type hub.approval_source as enum ('manual_admin', 'official_provider', 'guardian_attestation');
create type hub.validation_stage as enum ('metadata', 'binary');
create type hub.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table hub.publishers (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  status hub.publisher_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publishers_display_name_length check (display_name is null or char_length(display_name) between 1 and 120)
);

create table hub.publisher_wallets (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references hub.publishers(id) on delete restrict,
  wallet_address text not null unique,
  verified_at timestamptz not null default now(),
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint publisher_wallet_address_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

create table hub.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  purpose text not null,
  environment hub.app_environment not null,
  nonce_hash bytea not null unique,
  message text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_challenge_purpose check (purpose in ('authentication', 'distribution_consent')),
  constraint auth_challenge_attempts check (attempts between 0 and 5),
  constraint auth_challenge_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

create table hub.sessions (
  id uuid primary key default gen_random_uuid(),
  publisher_wallet_id uuid not null references hub.publisher_wallets(id) on delete cascade,
  token_hash bytea not null unique,
  csrf_hash bytea not null,
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sessions_expiry_order check (idle_expires_at <= absolute_expires_at)
);

create table hub.security_rate_buckets (
  subject_hash bytea not null,
  route_class text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (subject_hash, route_class, bucket_start),
  constraint security_rate_count_positive check (request_count > 0)
);

create table hub.apps (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references hub.publishers(id) on delete restrict,
  app_mint text not null unique,
  publisher_mint text not null,
  package_name text not null unique,
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  icon_uri text,
  screenshots jsonb not null default '[]'::jsonb,
  metadata_uri text not null,
  source_snapshot jsonb not null,
  source_snapshot_hash text not null,
  claim_status hub.claim_status not null default 'pending',
  release_policy hub.release_policy not null default 'manual',
  distribution_enabled boolean not null default false,
  authority_path hub.authority_path,
  authority_address text,
  authority_last_verified_slot bigint,
  authority_last_verified_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(package_name, '') || ' ' || coalesce(short_description, ''))
  ) stored,
  constraint apps_mint_format check (app_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint apps_publisher_mint_format check (publisher_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint apps_package_format check (package_name ~ '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$'),
  constraint apps_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint apps_name_length check (char_length(name) between 1 and 120),
  constraint apps_source_hash_format check (source_snapshot_hash ~ '^[0-9a-f]{64}$')
);

create table hub.app_claims (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references hub.apps(id) on delete cascade,
  publisher_wallet_id uuid not null references hub.publisher_wallets(id) on delete restrict,
  status hub.claim_status not null,
  authority_path hub.authority_path not null,
  finalized_slot bigint not null,
  evidence_hash text not null,
  evidence_snapshot jsonb not null,
  verified_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_claims_slot_positive check (finalized_slot > 0),
  constraint app_claims_evidence_hash check (evidence_hash ~ '^[0-9a-f]{64}$')
);

create unique index app_claims_one_current_verified
  on hub.app_claims (app_id)
  where status = 'verified' and superseded_at is null;

create table hub.distribution_consents (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references hub.apps(id) on delete restrict,
  publisher_wallet_id uuid not null references hub.publisher_wallets(id) on delete restrict,
  environment hub.app_environment not null,
  status hub.consent_status not null default 'active',
  message text not null,
  signature text not null,
  nonce_hash bytea not null unique,
  scopes text[] not null,
  release_policy hub.release_policy not null,
  terms_version text not null,
  issued_at timestamptz not null,
  signing_expires_at timestamptz not null,
  verified_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consent_signing_window check (issued_at < signing_expires_at),
  constraint consent_required_scopes check (
    scopes @> array['facilitate_apk_installation','list_app','monitor_future_releases','use_public_metadata']::text[]
    and cardinality(scopes) = 4
  )
);

create unique index distribution_consents_one_active_per_environment
  on hub.distribution_consents (app_id, environment)
  where status = 'active';

create table hub.releases (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references hub.apps(id) on delete restrict,
  release_mint text not null unique,
  metadata_uri text not null,
  source_snapshot jsonb not null,
  source_snapshot_hash text not null,
  package_name text not null,
  version_name text not null,
  version_code bigint not null,
  apk_uri text not null,
  apk_size bigint not null,
  apk_sha256 text not null,
  certificate_sha256 text not null,
  min_sdk integer not null,
  target_sdk integer,
  permissions text[] not null default '{}',
  locales text[] not null default '{}',
  collection_verified boolean not null,
  metadata_immutable boolean not null,
  validation_status hub.release_validation_status not null default 'discovered',
  publication_status hub.publication_status not null default 'unpublished',
  quarantine_code text,
  quarantine_detail text,
  discovered_slot bigint not null,
  discovered_at timestamptz not null default now(),
  validated_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint releases_mint_format check (release_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint releases_version_code_positive check (version_code > 0),
  constraint releases_version_name_length check (char_length(version_name) between 1 and 128),
  constraint releases_apk_size check (apk_size > 0 and apk_size <= 524288000),
  constraint releases_sha256_format check (apk_sha256 ~ '^[0-9a-f]{64}$'),
  constraint releases_certificate_format check (certificate_sha256 ~ '^[0-9a-f]{64}$'),
  constraint releases_source_hash_format check (source_snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint releases_sdk_bounds check (min_sdk between 1 and 100 and (target_sdk is null or target_sdk between min_sdk and 100)),
  constraint releases_https_apk check (apk_uri ~ '^https://')
);

create unique index releases_one_published_version
  on hub.releases (app_id, version_code)
  where publication_status = 'published';
create index releases_history_idx on hub.releases (app_id, version_code desc, discovered_at desc);
create index releases_catalog_idx on hub.releases (publication_status, published_at desc, id);

create table hub.release_validation_runs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references hub.releases(id) on delete cascade,
  stage hub.validation_stage not null,
  provider text not null,
  status hub.job_status not null default 'queued',
  correlation_id uuid not null unique default gen_random_uuid(),
  expected jsonb not null,
  observed jsonb,
  tool_versions jsonb,
  failure_codes text[] not null default '{}',
  log_digest text,
  oidc_subject text,
  oidc_replay_key_hash text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint validation_run_completion check (
    (status in ('queued', 'running') and completed_at is null)
    or (status in ('succeeded', 'failed', 'cancelled') and completed_at is not null)
  )
);

create index release_validation_runs_release_idx on hub.release_validation_runs (release_id, created_at desc);
create unique index release_validation_runs_oidc_replay
  on hub.release_validation_runs (oidc_replay_key_hash)
  where oidc_replay_key_hash is not null;

create table hub.release_approvals (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references hub.releases(id) on delete restrict,
  status hub.approval_status not null,
  source hub.approval_source not null,
  source_reference text,
  evidence jsonb not null default '{}'::jsonb,
  verified_by_wallet text,
  verified_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index release_approvals_one_current
  on hub.release_approvals (release_id)
  where superseded_at is null;

create table hub.approval_requests (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references hub.releases(id) on delete restrict,
  publisher_wallet_id uuid not null references hub.publisher_wallets(id) on delete restrict,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_request_status check (status in ('pending', 'accepted', 'rejected', 'cancelled'))
);

create table hub.sync_state (
  app_id uuid primary key references hub.apps(id) on delete cascade,
  last_finalized_slot bigint,
  last_cursor text,
  last_success_at timestamptz,
  next_sync_at timestamptz not null default now(),
  consecutive_failures integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint sync_failures_nonnegative check (consecutive_failures >= 0)
);

create table hub.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references hub.apps(id) on delete cascade,
  kind text not null,
  status hub.job_status not null default 'queued',
  attempt integer not null default 0,
  lease_owner text,
  lease_expires_at timestamptz,
  result jsonb,
  error_code text,
  error_detail text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sync_job_kind check (kind in ('claim', 'manual', 'scheduled', 'stale_refresh')),
  constraint sync_job_attempt_nonnegative check (attempt >= 0)
);

create unique index sync_jobs_one_active_per_app
  on hub.sync_jobs (app_id)
  where status in ('queued', 'running');
create index sync_jobs_due_idx on hub.sync_jobs (status, scheduled_at);

create table hub.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_wallet text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint admin_actor_wallet_format check (actor_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint admin_reason_length check (char_length(reason) between 4 and 1000)
);

create function hub.reject_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_audit_logs is append-only';
end
$$;

create trigger admin_audit_logs_append_only
before update or delete on hub.admin_audit_logs
for each row execute function hub.reject_admin_audit_mutation();

create table hub.runtime_config (
  key text primary key,
  value jsonb not null,
  updated_by_wallet text,
  updated_at timestamptz not null default now(),
  constraint runtime_config_key check (key in ('default_catalog_channel', 'approved_mode_enabled', 'maximum_apk_bytes', 'minimum_android_sdk', 'featured_app_ids'))
);

create index apps_search_idx on hub.apps using gin (search_document);
create index auth_challenges_expiry_idx on hub.auth_challenges (expires_at) where consumed_at is null;
create index sessions_expiry_idx on hub.sessions (idle_expires_at) where revoked_at is null;
create index rate_buckets_expiry_idx on hub.security_rate_buckets (expires_at);
create index sync_state_due_idx on hub.sync_state (next_sync_at);

grant select, insert, update, delete on all tables in schema hub to hub_backend;
revoke update, delete on hub.admin_audit_logs from hub_backend;
grant usage, select on all sequences in schema hub to hub_backend;
alter default privileges in schema hub grant select, insert, update, delete on tables to hub_backend;
alter default privileges in schema hub grant usage, select on sequences to hub_backend;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'publishers','publisher_wallets','auth_challenges','sessions','security_rate_buckets',
    'apps','app_claims','distribution_consents','releases','release_validation_runs',
    'release_approvals','approval_requests','sync_state','sync_jobs','admin_audit_logs','runtime_config'
  ]
  loop
    execute format('alter table hub.%I enable row level security', table_name);
    execute format('alter table hub.%I force row level security', table_name);
    execute format('create policy %I on hub.%I for all to hub_backend using (true) with check (true)', table_name || '_backend_only', table_name);
  end loop;
end
$$;

revoke all on all tables in schema hub from public, anon, authenticated;
revoke all on all sequences in schema hub from public, anon, authenticated;
