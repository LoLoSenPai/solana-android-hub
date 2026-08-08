create index app_claims_publisher_wallet_idx
  on hub.app_claims (publisher_wallet_id);

create index approval_requests_publisher_wallet_idx
  on hub.approval_requests (publisher_wallet_id);

create index approval_requests_release_idx
  on hub.approval_requests (release_id);

create index apps_publisher_idx
  on hub.apps (publisher_id);

create index distribution_consents_publisher_wallet_idx
  on hub.distribution_consents (publisher_wallet_id);

create index publisher_wallets_publisher_idx
  on hub.publisher_wallets (publisher_id);

create index sessions_publisher_wallet_idx
  on hub.sessions (publisher_wallet_id);
