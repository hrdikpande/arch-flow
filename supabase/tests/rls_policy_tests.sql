-- Row-level security tests. Each check runs as the `authenticated` role with a user's JWT subject.
-- Any failed expectation raises an exception. A clean run ends with the notice "RLS TESTS PASSED".
\set ON_ERROR_STOP 1
begin;

-- Users: admin (firm), head (project head on P1), client (client of P1), outsider (no roles).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.test'),
  ('00000000-0000-0000-0000-00000000000b', 'head@x.test'),
  ('00000000-0000-0000-0000-00000000000c', 'client@x.test'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@x.test');
insert into profiles (id, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@x.test'),
  ('00000000-0000-0000-0000-00000000000b', 'Head', 'head@x.test'),
  ('00000000-0000-0000-0000-00000000000c', 'Client', 'client@x.test'),
  ('00000000-0000-0000-0000-00000000000d', 'Outsider', 'outsider@x.test');
insert into client_orgs (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Org one'),
  ('00000000-0000-0000-0000-000000000002', 'Org two');
update profiles set client_org_id = '00000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-00000000000c';
insert into projects (id, code, name, client_org_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'P1-TEST', 'Project one', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'P2-TEST', 'Project two', '00000000-0000-0000-0000-000000000002');
insert into user_roles (user_id, role, project_id) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', null),
  ('00000000-0000-0000-0000-00000000000b', 'project_head', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000c', 'client', '00000000-0000-0000-0000-0000000000a1');

-- Sheets: S1 issued (P1), S2 in progress (P1), S3 issued (P2).
insert into sheets (id, project_id, sheet_number, title, discipline_code, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'M-101', 'Ground HVAC', 'HVAC', 'issued'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'M-102', 'First HVAC', 'HVAC', 'wip'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2', 'A-201', 'Elevation', 'ARC', 'issued');
insert into revisions (id, sheet_id, rev_code, seq, status, purpose, issued_at, issued_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'R0', 0, 'issued', 'issued', now(), '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'R1', 1, 'wip', null, null, null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'R0', 0, 'wip', null, null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b3', 'R0', 0, 'issued', 'issued', now(), '00000000-0000-0000-0000-00000000000a');
update sheets set current_revision_id = '00000000-0000-0000-0000-0000000000c1' where id = '00000000-0000-0000-0000-0000000000b1';
update sheets set current_revision_id = '00000000-0000-0000-0000-0000000000c4' where id = '00000000-0000-0000-0000-0000000000b3';
insert into files (id, project_id, sheet_id, revision_id, storage_path, original_name, format, size_bytes) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'P1/M-101/R0/a.pdf', 'a.pdf', 'pdf', 10),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c3', 'P1/M-102/R0/b.pdf', 'b.pdf', 'pdf', 10);
insert into conflicts (id, project_id, client_org_id, subject, raised_by, due_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Org one question', '00000000-0000-0000-0000-00000000000c', now() + interval '3 days'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002', 'Org two question', '00000000-0000-0000-0000-00000000000c', now() + interval '3 days');

-- Helpers: act as a user (JWT subject) with the authenticated role, and count rows.
create or replace function as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'reset role';
  execute 'set role authenticated';
end $$;

create or replace function expect_count(label text, query text, expected bigint) returns void language plpgsql as $$
declare actual bigint;
begin
  execute 'select count(*) from (' || query || ') q' into actual;
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok - %', label;
end $$;

create or replace function expect_refused(label text, stmt text) returns void language plpgsql as $$
declare refused boolean := false; affected int;
begin
  begin
    execute stmt;
    get diagnostics affected = row_count;
    if affected > 0 then refused := false; else refused := true; end if;
  exception when others then
    refused := true;
  end;
  if not refused then raise exception 'FAIL %: write was allowed', label; end if;
  raise notice 'ok - %', label;
end $$;

-- The authenticated role needs table privileges. RLS then decides which rows it can see (as in Supabase).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon;
grant select on all tables in schema public to anon;

-- ---- Admin ----
select as_user('00000000-0000-0000-0000-00000000000a');
select expect_count('admin sees all sheets', 'select id from sheets', 3);
select expect_count('admin sees all profiles', 'select id from profiles', 4);
select expect_count('admin can read the audit log', 'select id from audit_log', 0);

-- ---- Project head on P1 ----
select as_user('00000000-0000-0000-0000-00000000000b');
select expect_count('head sees only P1 sheets', 'select id from sheets', 2);
select expect_count('head sees P1 revisions, including work', 'select r.id from revisions r join sheets s on s.id = r.sheet_id', 3);
select expect_count('head sees only own profile', 'select id from profiles', 1);
select expect_count('head cannot read settings', 'select key from settings', 0);
select expect_count('head cannot read WhatsApp recipients', 'select id from whatsapp_recipients', 0);
select expect_count('head cannot read the audit log', 'select id from audit_log', 0);
select expect_count('head sees P1 conflicts', 'select id from conflicts', 1);
select expect_refused('head cannot insert a sheet directly', $q$insert into sheets (project_id, sheet_number, title, discipline_code) values ('00000000-0000-0000-0000-0000000000a1', 'X-1', 'x', 'ARC')$q$);
select expect_refused('head cannot change a sheet directly', $q$update sheets set title = 'changed' where id = '00000000-0000-0000-0000-0000000000b1'$q$);
select expect_refused('head cannot delete a sheet directly', $q$delete from sheets where id = '00000000-0000-0000-0000-0000000000b1'$q$);

-- ---- Client of P1 ----
select as_user('00000000-0000-0000-0000-00000000000c');
select expect_count('client sees only issued sheets of its project', 'select id from sheets', 1);
select expect_count('client sees only issued revisions', 'select id from revisions', 1);
select expect_count('client sees issued files only', 'select id from files', 1);
select expect_count('client sees only its own organisation conflicts', 'select id from conflicts', 1);
select expect_count('client sees the conflict thread of its own organisation only', 'select id from conflicts where client_org_id = (select client_org_id from profiles where id = auth.uid())', 1);
select expect_count('client cannot read settings', 'select key from settings', 0);
select expect_count('client cannot read the audit log', 'select id from audit_log', 0);
select expect_count('client cannot read WhatsApp outbox', 'select id from whatsapp_outbox', 0);
select expect_count('client cannot read other profiles', 'select id from profiles', 1);
select expect_refused('client cannot raise a conflict by direct insert', $q$insert into conflicts (project_id, client_org_id, subject, raised_by, due_at) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-00000000000c', now())$q$);
select expect_refused('client cannot change a revision', $q$update revisions set rev_code = 'R9' where id = '00000000-0000-0000-0000-0000000000c1'$q$);

-- ---- Outsider (no roles) ----
select as_user('00000000-0000-0000-0000-00000000000d');
select expect_count('outsider sees no sheets', 'select id from sheets', 0);
select expect_count('outsider sees no projects', 'select id from projects', 0);
select expect_count('outsider sees no conflicts', 'select id from conflicts', 0);
select expect_count('outsider sees no files', 'select id from files', 0);

-- ---- Anonymous (no session) ----
reset role;
set role anon;
select expect_count('anonymous sees no sheets', 'select id from sheets', 0);
reset role;
do $$ begin raise notice 'RLS TESTS PASSED'; end $$;
rollback;
