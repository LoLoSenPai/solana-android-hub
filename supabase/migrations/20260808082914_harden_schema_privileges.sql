revoke all on schema hub from service_role;
revoke all on all tables in schema hub from service_role;
revoke all on all sequences in schema hub from service_role;

revoke execute on all functions in schema hub from public, anon, authenticated, service_role;
grant execute on all functions in schema hub to hub_backend;

alter default privileges in schema hub revoke execute on functions from public;
alter default privileges in schema hub revoke execute on functions from anon, authenticated, service_role;
alter default privileges in schema hub grant execute on functions to hub_backend;
