alter table hub.releases
  add column icon_uri text,
  add column screenshots jsonb not null default '[]'::jsonb,
  add column banner_uri text,
  add column feature_graphic_uri text;

alter table hub.releases
  add constraint releases_screenshots_array check (jsonb_typeof(screenshots) = 'array');

-- postgres.js serializes a string passed to a jsonb parameter as a JSON string.
-- Repair the early preview records before backfilling their storefront media.
update hub.apps
set source_snapshot = (source_snapshot #>> '{}')::jsonb
where jsonb_typeof(source_snapshot) = 'string';

update hub.apps
set screenshots = (screenshots #>> '{}')::jsonb
where jsonb_typeof(screenshots) = 'string';

update hub.releases
set source_snapshot = (source_snapshot #>> '{}')::jsonb
where jsonb_typeof(source_snapshot) = 'string';

update hub.app_claims
set evidence_snapshot = (evidence_snapshot #>> '{}')::jsonb
where jsonb_typeof(evidence_snapshot) = 'string';

update hub.release_validation_runs
set expected = (expected #>> '{}')::jsonb
where jsonb_typeof(expected) = 'string';

update hub.release_validation_runs
set observed = (observed #>> '{}')::jsonb
where jsonb_typeof(observed) = 'string';

update hub.sync_jobs
set result = (result #>> '{}')::jsonb
where jsonb_typeof(result) = 'string';

update hub.releases as release
set
  icon_uri = coalesce(
    (
      select media.item ->> 'uri'
      from jsonb_array_elements(coalesce(release.source_snapshot #> '{releaseMetadata,extensions,solana_dapp_store,media}', '[]'::jsonb))
        with ordinality as media(item, position)
      where lower(regexp_replace(media.item ->> 'purpose', '[^a-zA-Z0-9]', '', 'g')) = 'icon'
      order by media.position
      limit 1
    ),
    app.icon_uri
  ),
  screenshots = coalesce(
    (
      select jsonb_agg(media.item ->> 'uri' order by media.position)
      from jsonb_array_elements(coalesce(release.source_snapshot #> '{releaseMetadata,extensions,solana_dapp_store,media}', '[]'::jsonb))
        with ordinality as media(item, position)
      where lower(regexp_replace(media.item ->> 'purpose', '[^a-zA-Z0-9]', '', 'g')) like '%screenshot%'
    ),
    app.screenshots,
    '[]'::jsonb
  ),
  banner_uri = (
    select media.item ->> 'uri'
    from jsonb_array_elements(coalesce(release.source_snapshot #> '{releaseMetadata,extensions,solana_dapp_store,media}', '[]'::jsonb))
      with ordinality as media(item, position)
    where lower(regexp_replace(media.item ->> 'purpose', '[^a-zA-Z0-9]', '', 'g')) = 'banner'
    order by media.position
    limit 1
  ),
  feature_graphic_uri = (
    select media.item ->> 'uri'
    from jsonb_array_elements(coalesce(release.source_snapshot #> '{releaseMetadata,extensions,solana_dapp_store,media}', '[]'::jsonb))
      with ordinality as media(item, position)
    where lower(regexp_replace(media.item ->> 'purpose', '[^a-zA-Z0-9]', '', 'g')) = 'featuregraphic'
    order by media.position
    limit 1
  )
from hub.apps as app
where app.id = release.app_id;

comment on column hub.releases.banner_uri is
  'Publisher-supplied landscape artwork from the verified Release metadata.';

comment on column hub.releases.feature_graphic_uri is
  'Publisher-supplied feature artwork from the verified Release metadata.';
