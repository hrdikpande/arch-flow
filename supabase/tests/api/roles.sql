-- PostgREST roles, matching what Supabase provides: anon and authenticated are granted through
-- the authenticator login; service_role bypasses RLS.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'pgrst-local'; end if;
end $$;
alter role service_role bypassrls;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to service_role;
