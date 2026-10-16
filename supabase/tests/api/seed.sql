-- One firm owner (allowlisted, opted in and confirmed) and one unknown number for the rejection test.
insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'owner@test.local');
insert into profiles (id, full_name, email, phone_e164) values ('11111111-1111-4111-8111-111111111111', 'Owner Test', 'owner@test.local', '+919000000001');
insert into user_roles (user_id, role, project_id) values ('11111111-1111-4111-8111-111111111111', 'admin', null);
insert into whatsapp_recipients (id, profile_id, phone_e164, opted_in, opt_in_confirmed_at, active)
  values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '+919000000001', true, now(), true);
