-- Feature tables added after the first build: authority templates, workload capacity,
-- Autodesk translation state, WhatsApp delivery status and checksums for stale-revision checks.

create table if not exists authority_templates (
  id          uuid primary key default gen_random_uuid(),
  authority   text not null,
  item        text not null,
  required    boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint authority_templates_unique unique (authority, item)
);

create table if not exists user_capacity (
  user_id          uuid primary key references profiles(id) on delete cascade,
  sheets_per_week  int not null default 0 check (sheets_per_week >= 0),
  hours_per_week   numeric(6, 1) not null default 0 check (hours_per_week >= 0),
  updated_at       timestamptz not null default now()
);

-- Translation (Autodesk Model Derivative) state per file.
alter table files add column if not exists aps_object_id text;
alter table files add column if not exists aps_status text not null default 'not_started'
  check (aps_status in ('not_started', 'uploading', 'uploaded', 'translating', 'success', 'failed', 'unsupported'));
alter table files add column if not exists aps_error text;
alter table files add column if not exists aps_checked_at timestamptz;

-- WhatsApp delivery status (Cloud API statuses: sent, delivered, read, failed).
alter table whatsapp_outbox add column if not exists delivery_status text;
alter table whatsapp_outbox add column if not exists delivery_error text;
create index if not exists whatsapp_outbox_wa_id on whatsapp_outbox (wa_message_id);

-- Size and modification time at issue, used by the stale-revision check (FIL-05).
alter table files add column if not exists size_at_issue bigint;

-- Change requests: link to the approval and track implementation (CHG-02).
alter table change_requests add column if not exists approval_id uuid references approvals(id);
alter table change_requests add column if not exists sheet_status_at_request text;

-- Review comments: a resolution is recorded with who resolved and when (RVW-02).
create index if not exists review_comments_revision on review_comments (revision_id);

-- Register import: keep the revision history rows counted separately.
alter table register_imports add column if not exists history_rows int not null default 0;

-- Row-level security for the new tables (internal roles read; writes go through the server).
alter table authority_templates enable row level security;
alter table user_capacity enable row level security;
create policy authority_templates_read on authority_templates for select to authenticated using (is_admin() or exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role <> 'client'));
create policy user_capacity_read on user_capacity for select to authenticated using (user_id = auth.uid() or is_admin());
