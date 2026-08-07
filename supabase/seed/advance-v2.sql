-- Local vertical-slice transition only. This state is reset by `pnpm supabase db reset`.
begin;

update hub.releases
set publication_status = 'ignored', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'
  and publication_status = 'preview';

update hub.releases
set publication_status = 'preview', updated_at = now()
where id = '20000000-0000-4000-8000-000000000002'
  and publication_status = 'unpublished';

do $$
begin
  if not exists (
    select 1
    from hub.releases
    where id = '20000000-0000-4000-8000-000000000002'
      and publication_status = 'preview'
      and version_code = 2
  ) then
    raise exception 'The local v2 fixture could not be activated';
  end if;
end
$$;

commit;
