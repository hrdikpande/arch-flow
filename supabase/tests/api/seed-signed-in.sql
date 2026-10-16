-- Data for the signed-in browser tests. Runs after seed.sql (which creates the owner).
insert into client_orgs (id, name, nda_required, allow_aps_processing, allow_native_download)
  values ('44444444-4444-4444-8444-444444444444', 'Client Org Test', false, true, true);

insert into auth.users (id, email) values ('33333333-3333-4333-8333-333333333333', 'client@test.local');
insert into profiles (id, full_name, email, client_org_id, is_active)
  values ('33333333-3333-4333-8333-333333333333', 'Client Test', 'client@test.local', '44444444-4444-4444-8444-444444444444', true);

insert into projects (id, code, name, status, client_org_id)
  values ('55555555-5555-4555-8555-555555555555', 'NRH-01', 'Test Tower', 'active', '44444444-4444-4444-8444-444444444444');

insert into user_roles (user_id, role, project_id) values
  ('33333333-3333-4333-8333-333333333333', 'client', '55555555-5555-4555-8555-555555555555');

-- A-101 is issued (visible to the client). A-102 is still in work (hidden from the client).
insert into sheets (id, project_id, sheet_number, title, discipline_code, status, owner_id)
  values ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'A-101', 'Ground floor plan', 'ARC', 'issued', '11111111-1111-4111-8111-111111111111'),
         ('66666666-6666-4666-8666-666666666667', '55555555-5555-4555-8555-555555555555', 'A-102', 'First floor plan', 'ARC', 'wip', '11111111-1111-4111-8111-111111111111');

insert into revisions (id, sheet_id, rev_code, seq, status, purpose, issued_at, issued_by)
  values ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'R1', 1, 'issued', 'issued', now(), '11111111-1111-4111-8111-111111111111'),
         ('88888888-8888-4888-8888-888888888888', '66666666-6666-4666-8666-666666666667', 'R0', 0, 'wip', null, null, null);

update sheets set current_revision_id = '77777777-7777-4777-8777-777777777777' where id = '66666666-6666-4666-8666-666666666666';
update sheets set current_revision_id = '88888888-8888-4888-8888-888888888888' where id = '66666666-6666-4666-8666-666666666667';

insert into files (id, project_id, sheet_id, revision_id, storage_path, original_name, format, size_bytes, state, uploaded_at, aps_status)
  values ('99999999-9999-4999-8999-999999999999', '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
          'projects/NRH-01/A-101/NRH-01_ARC_A-101_R01.pdf', 'NRH-01_ARC_A-101_R01.pdf', 'pdf', 1000, 'stored', now(), 'not_started'),
         ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
          'projects/NRH-01/A-101/NRH-01_ARC_A-101_R01.dwg', 'NRH-01_ARC_A-101_R01.dwg', 'dwg', 2000, 'translating', now() - interval '1 day', 'translating');

insert into clashes (id, project_id, number, title, description, priority, status, discipline_a, discipline_b)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'CLS-001', 'Duct vs beam', 'Duct clashes with beam B2 at grid C4.', 'critical', 'open', 'ARC', 'STR');
insert into clash_sheets (clash_id, sheet_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666');
