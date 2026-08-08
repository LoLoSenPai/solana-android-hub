alter table hub.apps
  add column publisher_collection_mint text;

update hub.apps
set publisher_collection_mint = publisher_mint
where publisher_mint is not null;

alter table hub.apps
  alter column publisher_mint drop not null;

alter table hub.apps
  add constraint apps_publisher_collection_mint_format
  check (
    publisher_collection_mint is null
    or publisher_collection_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  );

comment on column hub.apps.publisher_collection_mint is
  'Optional verified parent collection used by legacy Publisher NFT -> App NFT publications. Current portal App NFTs are standalone collection NFTs and leave this null.';

comment on column hub.apps.publisher_mint is
  'Deprecated rollout-compatibility column. Use publisher_collection_mint; retained temporarily for older application instances.';
