-- =====================================================================
-- Drawing Control & Alerts — database schema v2
-- STATUS: DRAFT. Not executed. Validate on a Supabase staging project first.
-- Target: Supabase Postgres 15+ (India region).
-- Conventions:
--   * UUID primary keys (gen_random_uuid), timestamptz in UTC.
--   * Every table has RLS enabled. Policies are outlined at the end and
--     must be written and tested per table before go-live (see SCHEMA.md).
--   * Business changes go through API functions that enforce the state
--     machine. Direct writes from client roles are not permitted.
-- =====================================================================

-- ---------- Enumerations --------------------------------------------

create type role_code as enum (
  'admin', 'project_head', 'discipline_lead', 'drafter', 'checker', 'client'
);

create type sheet_status as enum (
  'not_started', 'assigned', 'wip', 'internal_check', 'coordination',
  'approved', 'issued', 'client_review', 'commented', 'revised',
  'gfc', 'ifc', 'superseded'
);

create type revision_status as enum ('wip', 'issued', 'superseded');
create type issue_purpose as enum ('issued', 'ifc', 'gfc');
create type priority_level as enum ('critical', 'major', 'minor');
create type file_format as enum ('pdf', 'dwg', 'rvt', 'ifc', 'nwd', 'other');
create type file_state as enum ('uploading', 'stored', 'translating', 'translated', 'translation_failed');
create type approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type conflict_status as enum ('open', 'responded', 'awaiting_client', 'closed');
create type outbox_status as enum ('queued', 'sending', 'sent', 'failed', 'held', 'cancelled');
create type export_status as enum ('queued', 'building', 'ready', 'failed', 'expired');

-- ---------- Shared helpers ------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Identity, organisations, projects ------------------------

create table client_orgs (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  nda_required          boolean not null default false,
  nda_file_id           uuid,                 -- FK added after files table
  nda_uploaded_at       timestamptz,
  allow_aps_processing  boolean not null default true,   -- false = PDF only (NDA)
  allow_native_download boolean not null default true,   -- A-V1
  created_at            timestamptz not null default now()
);

create table profiles (
  id             uuid primary key references auth.users(id) on delete restrict,
  full_name      text not null,
  email          text not null unique,
  phone_e164     text,
  client_org_id  uuid references client_orgs(id),
  is_active      boolean not null default true,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

create table projects (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,            -- e.g. NRH-BLR-01
  name           text not null,
  client_org_id  uuid references client_orgs(id),
  status         text not null default 'active'
                 check (status in ('active', 'on_hold', 'closed', 'exported', 'deleted')),
  start_date     date,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger projects_updated before update on projects
  for each row execute function set_updated_at();

-- Roles. A user may hold several roles on one project (combined roles).
-- Admin is firm-wide (project_id is null). Every other role is per project.
create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        role_code not null,
  project_id  uuid references projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint user_roles_admin_is_firmwide check ((role = 'admin') = (project_id is null)),
  constraint user_roles_unique unique (user_id, role, project_id)
);

create table disciplines (
  code        text primary key,               -- used in file names
  name        text not null,
  sort_order  int  not null
);

insert into disciplines (code, name, sort_order) values
  ('ARC', 'Architecture',          1),
  ('STR', 'Structure',             2),
  ('CIV', 'Civil',                 3),
  ('HVAC', 'HVAC',                 4),
  ('ELE', 'Electrical',            5),
  ('PLB', 'Plumbing',              6),
  ('FIR', 'Fire',                  7),
  ('MGS', 'Medical Gas',           8),
  ('ELV', 'ELV',                   9),
  ('MEP', 'MEP Coordination',     10),
  ('LND', 'Landscape',            11),
  ('OTH', 'Other',                12);

create table holidays (
  day    date primary key,
  name   text not null,
  scope  text not null default 'firm'
);

-- Settings: firm defaults have project_id null; project overrides have a project_id.
-- NULLS NOT DISTINCT needs Postgres 15+.
create table settings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now(),
  constraint settings_unique unique nulls not distinct (project_id, key)
);

insert into settings (project_id, key, value) values
  (null, 'sla.internal_review_days',    '3'),
  (null, 'sla.client_review_days',      '5'),
  (null, 'sla.rfi_response_days',       '7'),
  (null, 'sla.submittal_approval_days', '10'),
  (null, 'sla.conflict_reply_days',     '3'),
  (null, 'approval.escalation_days',    '2'),
  (null, 'whatsapp.daily_cap',          '30'),
  (null, 'digest.time_local',           '"09:00"'),
  (null, 'digest.timezone',             '"Asia/Kolkata"'),
  (null, 'naming.file_pattern',         '"{PROJECT}_{DISCIPLINE}_{SHEET}_{REV}"'),
  (null, 'naming.transmittal_pattern',  '"{PROJECT}-TR-{YYYYMM}-{NNN}"');

-- ---------- Register: sheets, revisions, files -----------------------

create table sheets (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references projects(id) on delete cascade,
  sheet_number         text not null,
  title                text not null,
  discipline_code      text not null references disciplines(code),
  status               sheet_status not null default 'not_started',
  owner_id             uuid references profiles(id),
  due_date             date,
  current_revision_id  uuid,                    -- FK added after revisions
  is_live              boolean generated always as
                         (status in ('issued', 'gfc', 'ifc')) stored,
  created_by           uuid references profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint sheets_number_unique unique (project_id, sheet_number)
);
create trigger sheets_updated before update on sheets
  for each row execute function set_updated_at();

create table revisions (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references sheets(id) on delete cascade,
  rev_code     text not null check (rev_code ~ '^R[0-9]{1,3}$'),   -- R0, R1, R2
  seq          int  not null check (seq >= 0),
  status       revision_status not null default 'wip',
  purpose      issue_purpose,                   -- set when issued
  issued_at    timestamptz,
  issued_by    uuid references profiles(id),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  constraint revisions_seq_unique unique (sheet_id, seq),
  constraint revisions_code_unique unique (sheet_id, rev_code),
  constraint revisions_issued_fields check (
    (status = 'wip') or (issued_at is not null and issued_by is not null)
  )
);

alter table sheets
  add constraint sheets_current_revision_fk
  foreign key (current_revision_id) references revisions(id);

-- Issued revisions are immutable. Only status may change (issued -> superseded).
create or replace function enforce_revision_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'wip' then
    if (new.sheet_id, new.rev_code, new.seq, new.purpose, new.issued_at, new.issued_by)
       is distinct from
       (old.sheet_id, old.rev_code, old.seq, old.purpose, old.issued_at, old.issued_by) then
      raise exception 'issued revision % is immutable; create a new revision', old.id;
    end if;
    if old.status = 'superseded' and new.status <> 'superseded' then
      raise exception 'superseded revision % cannot change status', old.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger revisions_immutable before update on revisions
  for each row execute function enforce_revision_immutable();

create table files (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references projects(id) on delete cascade,
  sheet_id             uuid references sheets(id) on delete cascade,
  revision_id          uuid references revisions(id) on delete set null,
  storage_bucket       text not null default 'drawings',
  storage_path         text not null unique,
  original_name        text not null,
  format               file_format not null,
  size_bytes           bigint not null check (size_bytes >= 0),
  sha256               text,
  state                file_state not null default 'uploading',
  aps_urn              text,
  aps_job_id           text,
  translation_attempts int not null default 0,
  uploaded_by          uuid references profiles(id),
  uploaded_at          timestamptz not null default now()
);

alter table client_orgs
  add constraint client_orgs_nda_file_fk
  foreign key (nda_file_id) references files(id);

alter table profiles
  add constraint profiles_client_org_fk
  foreign key (client_org_id) references client_orgs(id);

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null unique references files(id) on delete cascade,
  entity_type  text not null check (entity_type in
                 ('conflict_message', 'review_comment', 'rfi', 'clash', 'change_request', 'submittal')),
  entity_id    uuid not null,
  created_at   timestamptz not null default now()
);

create table status_history (
  id           bigint generated always as identity primary key,
  entity_type  text not null,
  entity_id    uuid not null,
  from_state   text,
  to_state     text not null,
  actor_id     uuid references profiles(id),
  note         text,
  created_at   timestamptz not null default now()
);

create table review_comments (
  id               uuid primary key default gen_random_uuid(),
  revision_id      uuid not null references revisions(id) on delete cascade,
  author_id        uuid not null references profiles(id),
  body             text not null,
  status           text not null default 'open' check (status in ('open', 'closed')),
  resolved_by      uuid references profiles(id),
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now()
);

create table change_requests (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  sheet_id           uuid not null references sheets(id) on delete cascade,
  revision_id        uuid references revisions(id),
  reason             text not null,
  cost_impact        numeric(14, 2),
  time_impact_days   int,
  status             text not null default 'requested'
                     check (status in ('requested', 'approved', 'rejected', 'implemented')),
  requested_by       uuid references profiles(id),
  created_at         timestamptz not null default now()
);

-- ---------- Transmittals ---------------------------------------------

create table transmittal_counters (
  project_id  uuid not null references projects(id) on delete cascade,
  yyyymm      text not null check (yyyymm ~ '^[0-9]{6}$'),
  last_value  int  not null default 0,
  primary key (project_id, yyyymm)
);

create table transmittals (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  number             text not null unique,
  recipient_org_id   uuid references client_orgs(id),
  recipient_text     text,                       -- contractor or consultant name when not a client
  sent_at            timestamptz,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now()
);

create table transmittal_items (
  transmittal_id  uuid not null references transmittals(id) on delete cascade,
  revision_id     uuid not null references revisions(id),
  primary key (transmittal_id, revision_id)
);

-- Atomic per-project, per-month counter for transmittal numbers.
-- Pattern is hard-coded here for the pilot. Read it from settings if the pattern changes.
create or replace function next_transmittal_number(p_project uuid)
returns text
language plpgsql
as $$
declare
  v_code text;
  v_ym   text;
  v_n    int;
begin
  select code into v_code from projects where id = p_project;
  if v_code is null then
    raise exception 'unknown project %', p_project;
  end if;
  v_ym := to_char(now() at time zone 'Asia/Kolkata', 'YYYYMM');
  insert into transmittal_counters (project_id, yyyymm, last_value)
    values (p_project, v_ym, 1)
    on conflict (project_id, yyyymm)
    do update set last_value = transmittal_counters.last_value + 1
    returning last_value into v_n;
  return v_code || '-TR-' || v_ym || '-' || lpad(v_n::text, 3, '0');
end;
$$;

-- ---------- Clashes, RFIs, submittals, authority checklists ----------

create table clashes (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  number         text not null,
  title          text not null,
  description    text,
  priority       priority_level not null,
  status         text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  discipline_a   text references disciplines(code),
  discipline_b   text references disciplines(code),
  owner_id       uuid references profiles(id),
  due_date       date,
  source_ref     text,                         -- Navisworks clash ID from import
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  constraint clashes_number_unique unique (project_id, number)
);

create table clash_sheets (
  clash_id  uuid not null references clashes(id) on delete cascade,
  sheet_id  uuid not null references sheets(id) on delete cascade,
  primary key (clash_id, sheet_id)
);

create table rfis (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  number       text not null,
  subject      text not null,
  body         text,
  sheet_id     uuid references sheets(id),
  priority     priority_level not null default 'minor',
  status       text not null default 'open' check (status in ('open', 'answered', 'closed')),
  raised_by    uuid references profiles(id),
  assignee_id  uuid references profiles(id),
  due_date     date,
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint rfis_number_unique unique (project_id, number)
);

create table submittals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  number        text not null,
  item          text not null,
  sheet_id      uuid references sheets(id),
  status        text not null default 'submitted'
                check (status in ('submitted', 'under_review', 'approved',
                                  'approved_with_comments', 'rejected')),
  due_date      date,
  submitted_by  uuid references profiles(id),
  created_at    timestamptz not null default now(),
  constraint submittals_number_unique unique (project_id, number)
);

create table authority_checklists (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  authority       text not null,               -- e.g. Building sanction, Fire NOC, AERB
  item            text not null,
  required        boolean not null default true,
  sheet_id        uuid references sheets(id),
  status          text not null default 'pending'
                  check (status in ('pending', 'submitted', 'approved', 'not_applicable')),
  responsible_id  uuid references profiles(id),
  due_date        date,
  ticked_by       uuid references profiles(id),
  ticked_at       timestamptz
);

-- ---------- Approvals -------------------------------------------------

create table approvals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  entity_type   text not null,                -- 'sheet' for the pilot
  entity_id     uuid not null,
  transition    text not null,                -- e.g. 'change_live_sheet', 'internal_check_to_approved'
  requested_by  uuid not null references profiles(id),
  assignee_id   uuid not null references profiles(id),
  status        approval_status not null default 'pending',
  due_at        timestamptz not null,
  decided_by    uuid references profiles(id),
  decided_at    timestamptz,
  reason        text,
  escalated_at  timestamptz,
  escalated_to  uuid references profiles(id),
  created_at    timestamptz not null default now(),
  constraint approvals_rejection_reason check (status <> 'rejected' or reason is not null)
);

-- ---------- Conflicts (client portal) ---------------------------------

create table conflicts (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  client_org_id    uuid not null references client_orgs(id),
  sheet_id         uuid references sheets(id),
  transmittal_id   uuid references transmittals(id),
  subject          text not null check (char_length(subject) between 1 and 200),
  status           conflict_status not null default 'open',
  raised_by        uuid not null references profiles(id),
  due_at           timestamptz not null,       -- set from working-day rule when raised
  first_response_at timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now()
);

create table conflict_messages (
  id           uuid primary key default gen_random_uuid(),
  conflict_id  uuid not null references conflicts(id) on delete cascade,
  author_id    uuid not null references profiles(id),
  body         text not null check (char_length(body) between 1 and 10000),
  created_at   timestamptz not null default now()
);

-- ---------- Events, rules, in-app notifications ----------------------

create table events (
  id            bigint generated always as identity primary key,
  type          text not null,
  project_id    uuid references projects(id) on delete cascade,
  entity_type   text,
  entity_id     uuid,
  actor_id      uuid references profiles(id),
  payload       jsonb not null default '{}'::jsonb,
  rule_version  int,
  created_at    timestamptz not null default now()
);
create index events_project_time on events (project_id, created_at desc);
create index events_type_time on events (type, created_at desc);

create table rules (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,   -- null = firm-wide
  kind        text not null check (kind in
                ('critical_clash', 'critical_rfi', 'critical_revision', 'alert_event')),
  name        text not null,
  definition  jsonb not null,
  active      boolean not null default true,
  version     int not null default 1,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger rules_updated before update on rules
  for each row execute function set_updated_at();

create table rule_versions (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references rules(id) on delete cascade,
  version     int not null,
  definition  jsonb not null,
  changed_by  uuid references profiles(id),
  changed_at  timestamptz not null default now(),
  constraint rule_versions_unique unique (rule_id, version)
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  event_id    bigint references events(id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_unread on notifications (user_id, read_at);

-- ---------- WhatsApp -------------------------------------------------

create table whatsapp_recipients (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid references profiles(id) on delete cascade,
  phone_e164           text not null unique,
  opted_in             boolean not null default false,
  opt_in_confirmed_at  timestamptz,           -- written confirmation recorded by admin
  opted_out_at         timestamptz,           -- set by STOP
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create table whatsapp_event_settings (
  event_type  text primary key,
  enabled     boolean not null default false,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

create table whatsapp_outbox (
  id               uuid primary key default gen_random_uuid(),
  recipient_id     uuid not null references whatsapp_recipients(id) on delete cascade,
  kind             text not null check (kind in ('alert', 'digest', 'command_reply', 'escalation', 'health')),
  event_id         bigint references events(id) on delete set null,
  template_code    text not null,
  variables        jsonb not null default '{}'::jsonb,
  body_preview     text,                       -- rendered text, stored for audit
  dedupe_key       text not null unique,
  status           outbox_status not null default 'queued',
  attempts         int not null default 0,
  next_attempt_at  timestamptz not null default now(),
  wa_message_id    text,
  sent_at          timestamptz,
  last_error       text,
  created_at       timestamptz not null default now()
);
create index whatsapp_outbox_due on whatsapp_outbox (status, next_attempt_at);

create table whatsapp_inbound (
  id              uuid primary key default gen_random_uuid(),
  from_phone      text not null,
  recipient_id    uuid references whatsapp_recipients(id) on delete set null,
  body            text,
  command         text,
  is_allowed      boolean not null,
  reply_outbox_id uuid references whatsapp_outbox(id) on delete set null,
  received_at     timestamptz not null default now()
);

create table digests (
  id                    uuid primary key default gen_random_uuid(),
  recipient_id          uuid not null references whatsapp_recipients(id) on delete cascade,
  digest_date           date not null,
  trigger_type          text not null check (trigger_type in ('scheduled', 'on_demand')),
  deterministic_text    text not null,
  ai_text               text,
  ai_validated          boolean not null default false,
  ai_rejection_reason   text,
  sent_text             text,
  created_at            timestamptz not null default now()
);

-- ---------- Register import, export ---------------------------------

create table register_imports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  uploaded_by  uuid references profiles(id),
  file_id      uuid references files(id),
  status       text not null default 'validating'
               check (status in ('validating', 'ready', 'confirmed', 'failed', 'cancelled')),
  rows_total   int not null default 0,
  rows_ok      int not null default 0,
  rows_failed  int not null default 0,
  errors       jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table exports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  requested_by  uuid references profiles(id),
  status        export_status not null default 'queued',
  storage_path  text,
  sha256        text,
  size_bytes    bigint,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ---------- Audit (append-only) --------------------------------------

create table audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles(id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  project_id  uuid,
  before      jsonb,
  after       jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create or replace function forbid_audit_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;
create trigger audit_no_update_delete before update or delete on audit_log
  for each row execute function forbid_audit_change();
create trigger audit_no_truncate before truncate on audit_log
  for each statement execute function forbid_audit_change();

-- ---------- Helper functions for RLS ---------------------------------

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

create or replace function has_internal_project_role(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.project_id = p_project
      and ur.role <> 'client'
  );
$$;

create or replace function is_client_of_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.project_id = p_project
      and ur.role = 'client'
  );
$$;

-- ---------- Indexes for the main queries -----------------------------

create index sheets_project_status on sheets (project_id, status);
create index sheets_owner on sheets (owner_id);
create index sheets_due on sheets (due_date);
create index revisions_sheet on revisions (sheet_id);
create index files_sheet on files (sheet_id);
create index approvals_assignee_open on approvals (assignee_id, status);
create index conflicts_project_status on conflicts (project_id, status, due_at);
create index clashes_project_status on clashes (project_id, status, priority);
create index rfis_project_status on rfis (project_id, status, due_date);
create index user_roles_user on user_roles (user_id);

-- ---------- Row Level Security -----------------------------------------
-- Enable on every table. Policies below are an outline for the most
-- sensitive tables. Full policies are written and tested in Phase 1
-- (see SCHEMA.md, section 6).

alter table client_orgs            enable row level security;
alter table profiles               enable row level security;
alter table projects               enable row level security;
alter table user_roles             enable row level security;
alter table disciplines            enable row level security;
alter table holidays               enable row level security;
alter table settings               enable row level security;
alter table sheets                 enable row level security;
alter table revisions              enable row level security;
alter table files                  enable row level security;
alter table attachments            enable row level security;
alter table status_history         enable row level security;
alter table review_comments        enable row level security;
alter table change_requests        enable row level security;
alter table transmittal_counters   enable row level security;
alter table transmittals           enable row level security;
alter table transmittal_items      enable row level security;
alter table clashes                enable row level security;
alter table clash_sheets           enable row level security;
alter table rfis                   enable row level security;
alter table submittals             enable row level security;
alter table authority_checklists   enable row level security;
alter table approvals              enable row level security;
alter table conflicts              enable row level security;
alter table conflict_messages      enable row level security;
alter table events                 enable row level security;
alter table rules                  enable row level security;
alter table rule_versions          enable row level security;
alter table notifications          enable row level security;
alter table whatsapp_recipients    enable row level security;
alter table whatsapp_event_settings enable row level security;
alter table whatsapp_outbox        enable row level security;
alter table whatsapp_inbound       enable row level security;
alter table digests                enable row level security;
alter table register_imports       enable row level security;
alter table exports                enable row level security;
alter table audit_log              enable row level security;

-- Example policies (sheets). Clients read sheets through a restricted view,
-- not the base table. Full set to be written in Phase 1.
create policy sheets_read_internal on sheets
  for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));

-- Writes to sheets happen only through API functions that enforce the state
-- machine. No insert, update or delete policy is granted to end-user roles.

-- Example policy (notifications): users see their own notifications only.
create policy notifications_own on notifications
  for select to authenticated
  using (user_id = auth.uid());

-- =====================================================================
-- End of draft schema v2.
-- =====================================================================
