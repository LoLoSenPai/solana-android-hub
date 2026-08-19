create type hub.publisher_link_type as enum ('website', 'x', 'discord', 'telegram');

create table hub.app_publisher_links (
  app_id uuid not null references hub.apps(id) on delete cascade,
  link_type hub.publisher_link_type not null,
  url text not null,
  updated_by_wallet text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_id, link_type),
  constraint app_publisher_links_https_url check (url ~ '^https://[^[:space:]]+$'),
  constraint app_publisher_links_url_length check (char_length(url) between 9 and 2048),
  constraint app_publisher_links_wallet_format check (updated_by_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

create table hub.app_publisher_link_audit (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references hub.apps(id) on delete cascade,
  actor_wallet text not null,
  previous_links jsonb not null,
  next_links jsonb not null,
  created_at timestamptz not null default now(),
  constraint app_publisher_link_audit_wallet_format check (actor_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint app_publisher_link_audit_previous_object check (jsonb_typeof(previous_links) = 'object'),
  constraint app_publisher_link_audit_next_object check (jsonb_typeof(next_links) = 'object')
);

create index app_publisher_link_audit_app_created_idx
  on hub.app_publisher_link_audit (app_id, created_at desc);

grant usage on type hub.publisher_link_type to hub_backend;
grant select, insert, update, delete on hub.app_publisher_links to hub_backend;
grant select, insert on hub.app_publisher_link_audit to hub_backend;
revoke update, delete on hub.app_publisher_link_audit from hub_backend;

alter table hub.app_publisher_links enable row level security;
alter table hub.app_publisher_links force row level security;
create policy app_publisher_links_backend_only on hub.app_publisher_links
  for all to hub_backend using (true) with check (true);

alter table hub.app_publisher_link_audit enable row level security;
alter table hub.app_publisher_link_audit force row level security;
create policy app_publisher_link_audit_backend_read on hub.app_publisher_link_audit
  for select to hub_backend using (true);
create policy app_publisher_link_audit_backend_insert on hub.app_publisher_link_audit
  for insert to hub_backend with check (true);

revoke all on hub.app_publisher_links, hub.app_publisher_link_audit
  from public, anon, authenticated, service_role;
