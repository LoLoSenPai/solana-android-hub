create type hub.classification_source as enum ('publisher', 'hub_curated', 'solana_mobile');

create table hub.app_classifications (
  app_id uuid primary key references hub.apps(id) on delete cascade,
  primary_category text not null,
  tags text[] not null default '{}',
  source hub.classification_source not null,
  updated_by_wallet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_classifications_primary_category check (primary_category in (
    'ai-agents','content-streaming','defi','depin','games','lifestyle','nfts',
    'privacy-security','productivity','social-identity','wallets','other'
  )),
  constraint app_classifications_known_tags check (tags <@ array[
    'action','adventure','arcade','card','casual','puzzle','rpg','simulation','sports','strategy'
  ]::text[]),
  constraint app_classifications_genres_only_for_games check (primary_category = 'games' or cardinality(tags) = 0),
  constraint app_classifications_wallet_format check (
    updated_by_wallet is null or updated_by_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  )
);

grant select, insert, update, delete on hub.app_classifications to hub_backend;
alter table hub.app_classifications enable row level security;
alter table hub.app_classifications force row level security;
create policy app_classifications_backend_only on hub.app_classifications
  for all to hub_backend using (true) with check (true);

revoke all on hub.app_classifications from public, anon, authenticated, service_role;

-- DegenMerge predates Hub classification. The official v0.4.0 NFT category is
-- the Metaplex compatibility value "dApp", so the Hub records its storefront
-- category separately and keeps the provenance explicit.
insert into hub.app_classifications (app_id, primary_category, tags, source)
select id, 'games', array['casual','puzzle']::text[], 'hub_curated'
from hub.apps
where app_mint = '5W4YC8kHZnpxEPG5Q9ZC2CasxzQcaatLseDwjB4uSNBt'
on conflict (app_id) do nothing;
