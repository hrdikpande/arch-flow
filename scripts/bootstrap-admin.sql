-- Run ONCE per Supabase project, in the SQL editor, with the owner's details.
-- The first admin cannot be invited from inside the app, because only an admin can invite.
-- 1. In Supabase Auth, create the owner's user with their email (or invite them from the dashboard).
-- 2. Replace the email below and run this script.

do $$
declare
  v_email text := 'admin@arch-flow.com';
  v_name  text := 'Admin';
  v_uid   uuid;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise exception 'No auth user with email %. Create the user in Supabase Auth first.', v_email;
  end if;
  insert into profiles (id, full_name, email)
    values (v_uid, v_name, v_email)
    on conflict (id) do update set full_name = excluded.full_name;
  insert into user_roles (user_id, role, project_id)
    values (v_uid, 'admin', null)
    on conflict do nothing;
  raise notice 'Admin % is ready. Sign in at APP_URL/login.', v_email;
end $$;
