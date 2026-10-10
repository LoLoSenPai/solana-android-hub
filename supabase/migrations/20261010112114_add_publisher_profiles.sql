-- Profiles remain behind the existing private hub schema and backend-only RLS.
alter table hub.publishers
  add column profile_slug text,
  add column bio text,
  add column avatar_url text,
  add column portfolio_url text,
  add column profile_links jsonb not null default '{}'::jsonb,
  add constraint publishers_profile_slug_unique unique (profile_slug),
  add constraint publishers_profile_slug_format check (profile_slug is null or (
    profile_slug ~ '^[a-z][a-z0-9-]{2,47}$' and
    profile_slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')),
  add constraint publishers_profile_bio_length check (bio is null or char_length(bio) <= 1000),
  add constraint publishers_profile_avatar_https check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$')),
  add constraint publishers_profile_portfolio_https check (portfolio_url is null or (char_length(portfolio_url) <= 2048 and portfolio_url ~ '^https://[^[:space:]]+$')),
  add constraint publishers_profile_links_object check (jsonb_typeof(profile_links) = 'object');
