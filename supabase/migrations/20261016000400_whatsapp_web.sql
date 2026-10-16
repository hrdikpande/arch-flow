-- WhatsApp Web session (pilot). Written only by the WhatsApp Web process, with the service role.
-- The ciphertext is AES-256-GCM, with the key held in the process environment (WA_SESSION_KEY),
-- not in the database. RLS is on with no policies, so anon and signed-in users cannot read it.
create table if not exists whatsapp_sessions (
  id          text primary key,
  ciphertext  text not null,
  iv          text not null,
  tag         text not null,
  updated_at  timestamptz not null default now()
);

alter table whatsapp_sessions enable row level security;
revoke all on whatsapp_sessions from anon, authenticated;

-- Confirmed decisions (16 Oct 2026): upload and decision events send by default.
insert into whatsapp_event_settings (event_type, enabled) values
  ('file.uploaded', true),
  ('approval.requested', true),
  ('approval.escalated', true),
  ('conflict.raised', true),
  ('conflict.overdue', true),
  ('clash.opened', true),
  ('rfi.overdue', true),
  ('sheet.stale_revision', true),
  ('approval.approved', true),
  ('approval.rejected', true),
  ('conflict.responded', true),
  ('transmittal.sent', true),
  ('revision.issued', true)
on conflict (event_type) do update set enabled = excluded.enabled;
