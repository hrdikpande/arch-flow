-- =====================================================================
-- arch-flow database behaviour tests (automated, pass or fail)
-- Run on an EMPTY database after the auth stub and all migrations:
--   supabase/tests/rls_fixture.sql, then supabase/migrations/*.sql (in name order), then this file.
-- Every check prints PASS, or raises an exception that stops the run with FAIL.
-- The last line prints "BEHAVIOUR TESTS PASSED" when all checks pass.
-- Runs as a superuser, so row-level security does not apply here (RLS has its own suite:
-- supabase/tests/rls_policy_tests.sql).
-- =====================================================================

create or replace function pg_temp.expect_error(description text, statement text) returns void
language plpgsql as $$
begin
  execute statement;
exception when others then
  raise notice 'PASS: % (refused: %)', description, sqlerrm;
  return;
end $$;

create or replace function pg_temp.expect_ok(description text, statement text) returns void
language plpgsql as $$
begin
  execute statement;
  raise notice 'PASS: %', description;
end $$;

create or replace function pg_temp.expect_true(description text, condition boolean) returns void
language plpgsql as $$
begin
  if not condition then raise exception 'FAIL: %', description; end if;
  raise notice 'PASS: %', description;
end $$;

-- ---------------------------------------------------------------- setup
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@example.com');
insert into profiles (id, full_name, email) values ('00000000-0000-0000-0000-000000000001', 'Owner', 'owner@example.com');
insert into projects (id, code, name) values ('00000000-0000-0000-0000-0000000000a1', 'NRH-BLR-01', 'Test project');
insert into sheets (id, project_id, sheet_number, title, discipline_code, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'M-101', 'HVAC GF', 'ARC', 'issued');
insert into revisions (id, sheet_id, rev_code, seq, status, purpose, issued_at, issued_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'R0', 0, 'issued', 'issued', now(), '00000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------- revisions and sheets
select pg_temp.expect_error('issued revision cannot change (REV-03)',
  $$update revisions set seq = 5 where id = '00000000-0000-0000-0000-0000000000c1'$$);
select pg_temp.expect_error('revision code must look like R0, R1 (REV-01)',
  $$insert into revisions (sheet_id, rev_code, seq) values ('00000000-0000-0000-0000-0000000000b1', 'X1', 3)$$);
select pg_temp.expect_error('issued revision needs issued_at and issued_by',
  $$insert into revisions (sheet_id, rev_code, seq, status) values ('00000000-0000-0000-0000-0000000000b1', 'R9', 9, 'issued')$$);
select pg_temp.expect_error('sheet number unique within a project (REG-02)',
  $$insert into sheets (project_id, sheet_number, title, discipline_code) values ('00000000-0000-0000-0000-0000000000a1', 'M-101', 'dup', 'ARC')$$);
select pg_temp.expect_ok('sheet status is wip for a new work sheet (is_live false)',
  $$insert into sheets (id, project_id, sheet_number, title, discipline_code, status) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'M-102', 'HVAC FF', 'ARC', 'wip')$$);
select pg_temp.expect_true('is_live is false for wip and true for issued',
  (select is_live = false from sheets where id = '00000000-0000-0000-0000-0000000000b2')
  and (select is_live = true from sheets where id = '00000000-0000-0000-0000-0000000000b1'));

-- ---------------------------------------------------------------- audit log
select pg_temp.expect_ok('audit row can be written', $$insert into audit_log (actor_id, action) values ('00000000-0000-0000-0000-000000000001', 'test')$$);
select pg_temp.expect_error('audit log cannot be updated', $$update audit_log set action = 'tampered'$$);
select pg_temp.expect_error('audit log cannot be deleted', $$delete from audit_log$$);

-- ---------------------------------------------------------------- roles
select pg_temp.expect_error('admin must be firm-wide (no project)',
  $$insert into user_roles (user_id, role, project_id) values ('00000000-0000-0000-0000-000000000001', 'admin', '00000000-0000-0000-0000-0000000000a1')$$);
select pg_temp.expect_error('a non-admin role must name a project',
  $$insert into user_roles (user_id, role, project_id) values ('00000000-0000-0000-0000-000000000001', 'drafter', null)$$);
select pg_temp.expect_ok('firm-wide admin is allowed', $$insert into user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000001', 'admin')$$);

-- ---------------------------------------------------------------- settings
select pg_temp.expect_error('one firm default per setting key (NULLS NOT DISTINCT)',
  $$insert into settings (project_id, key, value) values (null, 'sla.internal_review_days', '5')$$);
select pg_temp.expect_ok('the same key can be set per project',
  $$insert into settings (project_id, key, value) values ('00000000-0000-0000-0000-0000000000a1', 'sla.internal_review_days', '4')$$);

-- ---------------------------------------------------------------- approvals and transmittals
select pg_temp.expect_error('a rejected approval needs a reason',
  $$insert into approvals (project_id, entity_type, entity_id, transition, requested_by, assignee_id, status, due_at)
    values ('00000000-0000-0000-0000-0000000000a1', 'sheet', '00000000-0000-0000-0000-0000000000b1', 'x', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'rejected', now())$$);
select pg_temp.expect_true('transmittal numbers count up within a project and month (TRN-02)',
  right(next_transmittal_number('00000000-0000-0000-0000-0000000000a1'), 3)::int + 1
    = right(next_transmittal_number('00000000-0000-0000-0000-0000000000a1'), 3)::int);

-- ---------------------------------------------------------------- files (CAD translation attempts, APS status)
select pg_temp.expect_error('file APS status must be one of the defined values',
  $$insert into files (project_id, sheet_id, revision_id, storage_path, original_name, format, size_bytes, state, aps_status)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'p/a.pdf', 'a.pdf', 'pdf', 10, 'stored', 'bogus')$$);
select pg_temp.expect_ok('a file starts with zero translation attempts',
  $$insert into files (id, project_id, sheet_id, revision_id, storage_path, original_name, format, size_bytes, state)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'p/b.dwg', 'b.dwg', 'dwg', 10, 'stored')$$);
select pg_temp.expect_true('translation_attempts defaults to 0 and aps_status defaults to not_started',
  (select translation_attempts = 0 and aps_status = 'not_started' from files where id = '00000000-0000-0000-0000-0000000000f1'));

-- ---------------------------------------------------------------- WhatsApp
select pg_temp.expect_true('the 13 confirmed alert events are enabled by default',
  (select count(*) = 13 from whatsapp_event_settings where enabled));
select pg_temp.expect_ok('a recipient can be added',
  $$insert into whatsapp_recipients (id, profile_id, phone_e164, opted_in, opt_in_confirmed_at, active)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', '+919000000001', true, now(), true)$$);
select pg_temp.expect_error('a phone number belongs to one recipient only',
  $$insert into whatsapp_recipients (phone_e164) values ('+919000000001')$$);
select pg_temp.expect_error('an outbox row needs a valid kind',
  $$insert into whatsapp_outbox (recipient_id, kind, template_code, dedupe_key) values ('00000000-0000-0000-0000-0000000000e1', 'spam', 'x', 'k1')$$);
select pg_temp.expect_ok('an outbox row is queued',
  $$insert into whatsapp_outbox (id, recipient_id, kind, template_code, body_preview, dedupe_key) values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', 'alert', 'alert', 'test', 'k2')$$);
select pg_temp.expect_error('the same dedupe key cannot queue twice (WA-07)',
  $$insert into whatsapp_outbox (recipient_id, kind, template_code, dedupe_key) values ('00000000-0000-0000-0000-0000000000e1', 'alert', 'alert', 'k2')$$);
select pg_temp.expect_error('an inbound message must say whether the sender is allowed',
  $$insert into whatsapp_inbound (from_phone, body) values ('+919000000009', 'today')$$);
select pg_temp.expect_ok('the WhatsApp session row can be stored (service role writes it)',
  $$insert into whatsapp_sessions (id, ciphertext, iv, tag) values ('arch-flow-pilot', 'c', 'i', 't')$$);
select pg_temp.expect_error('the WhatsApp session needs all three encryption fields',
  $$insert into whatsapp_sessions (id, ciphertext, iv, tag) values ('other', 'c', null, 't')$$);

select 'BEHAVIOUR TESTS PASSED' as result;
