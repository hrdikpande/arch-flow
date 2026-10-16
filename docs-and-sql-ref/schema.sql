-- =====================================================================
-- arch-flow database schema (generated from the migrations, 16 Oct 2026)
-- Source: supabase/migrations/*.sql applied in name order to PostgreSQL 16.
-- Regenerate with: pg_dump --schema-only --no-owner --no-privileges -n public <db>
-- Do not edit by hand. Change a migration, then regenerate this file.
-- Verified: supabase/tests/rls_policy_tests.sql (RLS) and schema_behaviour_tests.sql (rules).
-- =====================================================================

\restrict 0ig6VHGkJvgUSJF5WljitfNGwdp4jfPGJg2wdX72lgSZlqkMJu9VhYxBRlBNLRH

CREATE SCHEMA public;

COMMENT ON SCHEMA public IS 'standard public schema';

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);

CREATE TYPE public.conflict_status AS ENUM (
    'open',
    'responded',
    'awaiting_client',
    'closed'
);

CREATE TYPE public.export_status AS ENUM (
    'queued',
    'building',
    'ready',
    'failed',
    'expired'
);

CREATE TYPE public.file_format AS ENUM (
    'pdf',
    'dwg',
    'rvt',
    'ifc',
    'nwd',
    'other'
);

CREATE TYPE public.file_state AS ENUM (
    'uploading',
    'stored',
    'translating',
    'translated',
    'translation_failed'
);

CREATE TYPE public.issue_purpose AS ENUM (
    'issued',
    'ifc',
    'gfc'
);

CREATE TYPE public.outbox_status AS ENUM (
    'queued',
    'sending',
    'sent',
    'failed',
    'held',
    'cancelled'
);

CREATE TYPE public.priority_level AS ENUM (
    'critical',
    'major',
    'minor'
);

CREATE TYPE public.revision_status AS ENUM (
    'wip',
    'issued',
    'superseded'
);

CREATE TYPE public.role_code AS ENUM (
    'admin',
    'project_head',
    'discipline_lead',
    'drafter',
    'checker',
    'client'
);

CREATE TYPE public.sheet_status AS ENUM (
    'not_started',
    'assigned',
    'wip',
    'internal_check',
    'coordination',
    'approved',
    'issued',
    'client_review',
    'commented',
    'revised',
    'gfc',
    'ifc',
    'superseded'
);

CREATE FUNCTION public.enforce_revision_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

CREATE FUNCTION public.forbid_audit_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

CREATE FUNCTION public.has_internal_project_role(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.project_id = p_project
      and ur.role <> 'client'
  );
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

CREATE FUNCTION public.is_client_of_project(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
      and ur.project_id = p_project
      and ur.role = 'client'
  );
$$;

CREATE FUNCTION public.next_transmittal_number(p_project uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
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

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    transition text NOT NULL,
    requested_by uuid NOT NULL,
    assignee_id uuid NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    due_at timestamp with time zone NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    reason text,
    escalated_at timestamp with time zone,
    escalated_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approvals_rejection_reason CHECK (((status <> 'rejected'::public.approval_status) OR (reason IS NOT NULL)))
);

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_entity_type_check CHECK ((entity_type = ANY (ARRAY['conflict_message'::text, 'review_comment'::text, 'rfi'::text, 'clash'::text, 'change_request'::text, 'submittal'::text])))
);

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    project_id uuid,
    before jsonb,
    after jsonb,
    ip inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.authority_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    authority text NOT NULL,
    item text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    sheet_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    responsible_id uuid,
    due_date date,
    ticked_by uuid,
    ticked_at timestamp with time zone,
    CONSTRAINT authority_checklists_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'not_applicable'::text])))
);

CREATE TABLE public.authority_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    authority text NOT NULL,
    item text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    revision_id uuid,
    reason text NOT NULL,
    cost_impact numeric(14,2),
    time_impact_days integer,
    status text DEFAULT 'requested'::text NOT NULL,
    requested_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_id uuid,
    sheet_status_at_request text,
    CONSTRAINT change_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'implemented'::text])))
);

CREATE TABLE public.clash_sheets (
    clash_id uuid NOT NULL,
    sheet_id uuid NOT NULL
);

CREATE TABLE public.clashes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    number text NOT NULL,
    title text NOT NULL,
    description text,
    priority public.priority_level NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    discipline_a text,
    discipline_b text,
    owner_id uuid,
    due_date date,
    source_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT clashes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'closed'::text])))
);

CREATE TABLE public.client_orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    nda_required boolean DEFAULT false NOT NULL,
    nda_file_id uuid,
    nda_uploaded_at timestamp with time zone,
    allow_aps_processing boolean DEFAULT true NOT NULL,
    allow_native_download boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.conflict_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conflict_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conflict_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 10000)))
);

CREATE TABLE public.conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    client_org_id uuid NOT NULL,
    sheet_id uuid,
    transmittal_id uuid,
    subject text NOT NULL,
    status public.conflict_status DEFAULT 'open'::public.conflict_status NOT NULL,
    raised_by uuid NOT NULL,
    due_at timestamp with time zone NOT NULL,
    first_response_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conflicts_subject_check CHECK (((char_length(subject) >= 1) AND (char_length(subject) <= 200)))
);

CREATE TABLE public.digests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    digest_date date NOT NULL,
    trigger_type text NOT NULL,
    deterministic_text text NOT NULL,
    ai_text text,
    ai_validated boolean DEFAULT false NOT NULL,
    ai_rejection_reason text,
    sent_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT digests_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['scheduled'::text, 'on_demand'::text])))
);

CREATE TABLE public.disciplines (
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer NOT NULL
);

CREATE TABLE public.events (
    id bigint NOT NULL,
    type text NOT NULL,
    project_id uuid,
    entity_type text,
    entity_id uuid,
    actor_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    rule_version integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    requested_by uuid,
    status public.export_status DEFAULT 'queued'::public.export_status NOT NULL,
    storage_path text,
    sha256 text,
    size_bytes bigint,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    sheet_id uuid,
    revision_id uuid,
    storage_bucket text DEFAULT 'drawings'::text NOT NULL,
    storage_path text NOT NULL,
    original_name text NOT NULL,
    format public.file_format NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 text,
    state public.file_state DEFAULT 'uploading'::public.file_state NOT NULL,
    aps_urn text,
    aps_job_id text,
    translation_attempts integer DEFAULT 0 NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    aps_object_id text,
    aps_status text DEFAULT 'not_started'::text NOT NULL,
    aps_error text,
    aps_checked_at timestamp with time zone,
    size_at_issue bigint,
    CONSTRAINT files_aps_status_check CHECK ((aps_status = ANY (ARRAY['not_started'::text, 'uploading'::text, 'uploaded'::text, 'translating'::text, 'success'::text, 'failed'::text, 'unsupported'::text]))),
    CONSTRAINT files_size_bytes_check CHECK ((size_bytes >= 0))
);

CREATE TABLE public.holidays (
    day date NOT NULL,
    name text NOT NULL,
    scope text DEFAULT 'firm'::text NOT NULL
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_id bigint,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone_e164 text,
    client_org_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    client_org_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'on_hold'::text, 'closed'::text, 'exported'::text, 'deleted'::text])))
);

CREATE TABLE public.register_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    uploaded_by uuid,
    file_id uuid,
    status text DEFAULT 'validating'::text NOT NULL,
    rows_total integer DEFAULT 0 NOT NULL,
    rows_ok integer DEFAULT 0 NOT NULL,
    rows_failed integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    history_rows integer DEFAULT 0 NOT NULL,
    CONSTRAINT register_imports_status_check CHECK ((status = ANY (ARRAY['validating'::text, 'ready'::text, 'confirmed'::text, 'failed'::text, 'cancelled'::text])))
);

CREATE TABLE public.review_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    revision_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_comments_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);

CREATE TABLE public.revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sheet_id uuid NOT NULL,
    rev_code text NOT NULL,
    seq integer NOT NULL,
    status public.revision_status DEFAULT 'wip'::public.revision_status NOT NULL,
    purpose public.issue_purpose,
    issued_at timestamp with time zone,
    issued_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT revisions_issued_fields CHECK (((status = 'wip'::public.revision_status) OR ((issued_at IS NOT NULL) AND (issued_by IS NOT NULL)))),
    CONSTRAINT revisions_rev_code_check CHECK ((rev_code ~ '^R[0-9]{1,3}$'::text)),
    CONSTRAINT revisions_seq_check CHECK ((seq >= 0))
);

CREATE TABLE public.rfis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    number text NOT NULL,
    subject text NOT NULL,
    body text,
    sheet_id uuid,
    priority public.priority_level DEFAULT 'minor'::public.priority_level NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    raised_by uuid,
    assignee_id uuid,
    due_date date,
    answer text,
    answered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rfis_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text])))
);

CREATE TABLE public.rule_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    version integer NOT NULL,
    definition jsonb NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    kind text NOT NULL,
    name text NOT NULL,
    definition jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rules_kind_check CHECK ((kind = ANY (ARRAY['critical_clash'::text, 'critical_rfi'::text, 'critical_revision'::text, 'alert_event'::text])))
);

CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    sheet_number text NOT NULL,
    title text NOT NULL,
    discipline_code text NOT NULL,
    status public.sheet_status DEFAULT 'not_started'::public.sheet_status NOT NULL,
    owner_id uuid,
    due_date date,
    current_revision_id uuid,
    is_live boolean GENERATED ALWAYS AS ((status = ANY (ARRAY['issued'::public.sheet_status, 'gfc'::public.sheet_status, 'ifc'::public.sheet_status]))) STORED,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.status_history (
    id bigint NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    from_state text,
    to_state text NOT NULL,
    actor_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.status_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.submittals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    number text NOT NULL,
    item text NOT NULL,
    sheet_id uuid,
    status text DEFAULT 'submitted'::text NOT NULL,
    due_date date,
    submitted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT submittals_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text, 'approved_with_comments'::text, 'rejected'::text])))
);

CREATE TABLE public.transmittal_counters (
    project_id uuid NOT NULL,
    yyyymm text NOT NULL,
    last_value integer DEFAULT 0 NOT NULL,
    CONSTRAINT transmittal_counters_yyyymm_check CHECK ((yyyymm ~ '^[0-9]{6}$'::text))
);

CREATE TABLE public.transmittal_items (
    transmittal_id uuid NOT NULL,
    revision_id uuid NOT NULL
);

CREATE TABLE public.transmittals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    number text NOT NULL,
    recipient_org_id uuid,
    recipient_text text,
    sent_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_capacity (
    user_id uuid NOT NULL,
    sheets_per_week integer DEFAULT 0 NOT NULL,
    hours_per_week numeric(6,1) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_capacity_hours_per_week_check CHECK ((hours_per_week >= (0)::numeric)),
    CONSTRAINT user_capacity_sheets_per_week_check CHECK ((sheets_per_week >= 0))
);

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.role_code NOT NULL,
    project_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_admin_is_firmwide CHECK (((role = 'admin'::public.role_code) = (project_id IS NULL)))
);

CREATE TABLE public.whatsapp_event_settings (
    event_type text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.whatsapp_inbound (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_phone text NOT NULL,
    recipient_id uuid,
    body text,
    command text,
    is_allowed boolean NOT NULL,
    reply_outbox_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.whatsapp_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    kind text NOT NULL,
    event_id bigint,
    template_code text NOT NULL,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    body_preview text,
    dedupe_key text NOT NULL,
    status public.outbox_status DEFAULT 'queued'::public.outbox_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    wa_message_id text,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_status text,
    delivery_error text,
    CONSTRAINT whatsapp_outbox_kind_check CHECK ((kind = ANY (ARRAY['alert'::text, 'digest'::text, 'command_reply'::text, 'escalation'::text, 'health'::text])))
);

CREATE TABLE public.whatsapp_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    phone_e164 text NOT NULL,
    opted_in boolean DEFAULT false NOT NULL,
    opt_in_confirmed_at timestamp with time zone,
    opted_out_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.whatsapp_sessions (
    id text NOT NULL,
    ciphertext text NOT NULL,
    iv text NOT NULL,
    tag text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_file_id_key UNIQUE (file_id);

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.authority_checklists
    ADD CONSTRAINT authority_checklists_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.authority_templates
    ADD CONSTRAINT authority_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.authority_templates
    ADD CONSTRAINT authority_templates_unique UNIQUE (authority, item);

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clash_sheets
    ADD CONSTRAINT clash_sheets_pkey PRIMARY KEY (clash_id, sheet_id);

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_number_unique UNIQUE (project_id, number);

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_orgs
    ADD CONSTRAINT client_orgs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conflict_messages
    ADD CONSTRAINT conflict_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.disciplines
    ADD CONSTRAINT disciplines_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exports
    ADD CONSTRAINT exports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_storage_path_key UNIQUE (storage_path);

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (day);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_code_key UNIQUE (code);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.register_imports
    ADD CONSTRAINT register_imports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_code_unique UNIQUE (sheet_id, rev_code);

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_seq_unique UNIQUE (sheet_id, seq);

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_number_unique UNIQUE (project_id, number);

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rule_versions
    ADD CONSTRAINT rule_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rule_versions
    ADD CONSTRAINT rule_versions_unique UNIQUE (rule_id, version);

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_unique UNIQUE NULLS NOT DISTINCT (project_id, key);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_number_unique UNIQUE (project_id, sheet_number);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.submittals
    ADD CONSTRAINT submittals_number_unique UNIQUE (project_id, number);

ALTER TABLE ONLY public.submittals
    ADD CONSTRAINT submittals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transmittal_counters
    ADD CONSTRAINT transmittal_counters_pkey PRIMARY KEY (project_id, yyyymm);

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_pkey PRIMARY KEY (transmittal_id, revision_id);

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_number_key UNIQUE (number);

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_capacity
    ADD CONSTRAINT user_capacity_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_unique UNIQUE (user_id, role, project_id);

ALTER TABLE ONLY public.whatsapp_event_settings
    ADD CONSTRAINT whatsapp_event_settings_pkey PRIMARY KEY (event_type);

ALTER TABLE ONLY public.whatsapp_inbound
    ADD CONSTRAINT whatsapp_inbound_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_dedupe_key_key UNIQUE (dedupe_key);

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_recipients
    ADD CONSTRAINT whatsapp_recipients_phone_e164_key UNIQUE (phone_e164);

ALTER TABLE ONLY public.whatsapp_recipients
    ADD CONSTRAINT whatsapp_recipients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id);

CREATE INDEX approvals_assignee_open ON public.approvals USING btree (assignee_id, status);

CREATE INDEX clashes_project_status ON public.clashes USING btree (project_id, status, priority);

CREATE INDEX conflicts_project_status ON public.conflicts USING btree (project_id, status, due_at);

CREATE INDEX events_project_time ON public.events USING btree (project_id, created_at DESC);

CREATE INDEX events_type_time ON public.events USING btree (type, created_at DESC);

CREATE INDEX files_sheet ON public.files USING btree (sheet_id);

CREATE INDEX notifications_user_unread ON public.notifications USING btree (user_id, read_at);

CREATE INDEX review_comments_revision ON public.review_comments USING btree (revision_id);

CREATE INDEX revisions_sheet ON public.revisions USING btree (sheet_id);

CREATE INDEX rfis_project_status ON public.rfis USING btree (project_id, status, due_date);

CREATE INDEX sheets_due ON public.sheets USING btree (due_date);

CREATE INDEX sheets_owner ON public.sheets USING btree (owner_id);

CREATE INDEX sheets_project_status ON public.sheets USING btree (project_id, status);

CREATE INDEX user_roles_user ON public.user_roles USING btree (user_id);

CREATE INDEX whatsapp_outbox_due ON public.whatsapp_outbox USING btree (status, next_attempt_at);

CREATE INDEX whatsapp_outbox_wa_id ON public.whatsapp_outbox USING btree (wa_message_id);

CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_audit_change();

CREATE TRIGGER audit_no_update_delete BEFORE DELETE OR UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.forbid_audit_change();

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER revisions_immutable BEFORE UPDATE ON public.revisions FOR EACH ROW EXECUTE FUNCTION public.enforce_revision_immutable();

CREATE TRIGGER rules_updated BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sheets_updated BEFORE UPDATE ON public.sheets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.authority_checklists
    ADD CONSTRAINT authority_checklists_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.authority_checklists
    ADD CONSTRAINT authority_checklists_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.authority_checklists
    ADD CONSTRAINT authority_checklists_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);

ALTER TABLE ONLY public.authority_checklists
    ADD CONSTRAINT authority_checklists_ticked_by_fkey FOREIGN KEY (ticked_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id);

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.revisions(id);

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clash_sheets
    ADD CONSTRAINT clash_sheets_clash_id_fkey FOREIGN KEY (clash_id) REFERENCES public.clashes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clash_sheets
    ADD CONSTRAINT clash_sheets_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_discipline_a_fkey FOREIGN KEY (discipline_a) REFERENCES public.disciplines(code);

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_discipline_b_fkey FOREIGN KEY (discipline_b) REFERENCES public.disciplines(code);

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.clashes
    ADD CONSTRAINT clashes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_orgs
    ADD CONSTRAINT client_orgs_nda_file_fk FOREIGN KEY (nda_file_id) REFERENCES public.files(id);

ALTER TABLE ONLY public.conflict_messages
    ADD CONSTRAINT conflict_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.conflict_messages
    ADD CONSTRAINT conflict_messages_conflict_id_fkey FOREIGN KEY (conflict_id) REFERENCES public.conflicts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_client_org_id_fkey FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id);

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);

ALTER TABLE ONLY public.conflicts
    ADD CONSTRAINT conflicts_transmittal_id_fkey FOREIGN KEY (transmittal_id) REFERENCES public.transmittals(id);

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.whatsapp_recipients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exports
    ADD CONSTRAINT exports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exports
    ADD CONSTRAINT exports_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.revisions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_client_org_fk FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_client_org_id_fkey FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_org_id_fkey FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.register_imports
    ADD CONSTRAINT register_imports_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);

ALTER TABLE ONLY public.register_imports
    ADD CONSTRAINT register_imports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.register_imports
    ADD CONSTRAINT register_imports_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.revisions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);

ALTER TABLE ONLY public.rule_versions
    ADD CONSTRAINT rule_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.rule_versions
    ADD CONSTRAINT rule_versions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rules(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_current_revision_fk FOREIGN KEY (current_revision_id) REFERENCES public.revisions(id);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_discipline_code_fkey FOREIGN KEY (discipline_code) REFERENCES public.disciplines(code);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.submittals
    ADD CONSTRAINT submittals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.submittals
    ADD CONSTRAINT submittals_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);

ALTER TABLE ONLY public.submittals
    ADD CONSTRAINT submittals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.transmittal_counters
    ADD CONSTRAINT transmittal_counters_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.revisions(id);

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_transmittal_id_fkey FOREIGN KEY (transmittal_id) REFERENCES public.transmittals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_recipient_org_id_fkey FOREIGN KEY (recipient_org_id) REFERENCES public.client_orgs(id);

ALTER TABLE ONLY public.user_capacity
    ADD CONSTRAINT user_capacity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.whatsapp_event_settings
    ADD CONSTRAINT whatsapp_event_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.whatsapp_inbound
    ADD CONSTRAINT whatsapp_inbound_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.whatsapp_recipients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.whatsapp_inbound
    ADD CONSTRAINT whatsapp_inbound_reply_outbox_id_fkey FOREIGN KEY (reply_outbox_id) REFERENCES public.whatsapp_outbox(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.whatsapp_recipients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.whatsapp_recipients
    ADD CONSTRAINT whatsapp_recipients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY approvals_read ON public.approvals FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_internal ON public.attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = attachments.file_id) AND (public.is_admin() OR public.has_internal_project_role(f.project_id))))));

CREATE POLICY audit_admin ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.authority_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY authority_checklists_internal ON public.authority_checklists FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.authority_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY authority_templates_read ON public.authority_templates FOR SELECT TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role <> 'client'::public.role_code))))));

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY change_requests_internal ON public.change_requests FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.clash_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY clash_sheets_internal ON public.clash_sheets FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clashes c
  WHERE ((c.id = clash_sheets.clash_id) AND (public.is_admin() OR public.has_internal_project_role(c.project_id))))));

ALTER TABLE public.clashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clashes_read ON public.clashes FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conflict_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conflict_messages_internal ON public.conflict_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conflicts c
  WHERE ((c.id = conflict_messages.conflict_id) AND (public.is_admin() OR public.has_internal_project_role(c.project_id))))));

CREATE POLICY conflict_messages_read_client ON public.conflict_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conflicts c
  WHERE ((c.id = conflict_messages.conflict_id) AND (c.client_org_id = ( SELECT profiles.client_org_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))));

ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY conflicts_internal ON public.conflicts FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

CREATE POLICY conflicts_read_client ON public.conflicts FOR SELECT TO authenticated USING ((public.is_client_of_project(project_id) AND (client_org_id = ( SELECT profiles.client_org_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY digests_admin ON public.digests FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY disciplines_read ON public.disciplines FOR SELECT TO authenticated USING (true);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_read ON public.events FOR SELECT TO authenticated USING ((public.is_admin() OR ((project_id IS NOT NULL) AND public.has_internal_project_role(project_id))));

ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY exports_admin ON public.exports FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY files_read_client ON public.files FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.revisions r
  WHERE ((r.id = files.revision_id) AND (r.status = ANY (ARRAY['issued'::public.revision_status, 'superseded'::public.revision_status])) AND public.is_client_of_project(files.project_id)))));

CREATE POLICY files_read_internal ON public.files FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY holidays_read ON public.holidays FOR SELECT TO authenticated USING (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY notifications_read_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_admin ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY profiles_self ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_read ON public.projects FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(id)));

ALTER TABLE public.register_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY register_imports_internal ON public.register_imports FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_comments_internal ON public.review_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.revisions r
     JOIN public.sheets s ON ((s.id = r.sheet_id)))
  WHERE ((r.id = review_comments.revision_id) AND (public.is_admin() OR public.has_internal_project_role(s.project_id))))));

ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY revisions_read_client ON public.revisions FOR SELECT TO authenticated USING (((status = ANY (ARRAY['issued'::public.revision_status, 'superseded'::public.revision_status])) AND (EXISTS ( SELECT 1
   FROM public.sheets s
  WHERE ((s.id = revisions.sheet_id) AND public.is_client_of_project(s.project_id))))));

CREATE POLICY revisions_read_internal ON public.revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.sheets s
  WHERE ((s.id = revisions.sheet_id) AND (public.is_admin() OR public.has_internal_project_role(s.project_id))))));

ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY rfis_read ON public.rfis FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rule_versions_admin ON public.rule_versions FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rules_admin ON public.rules FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_admin ON public.settings FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY sheets_read_client ON public.sheets FOR SELECT TO authenticated USING ((public.is_client_of_project(project_id) AND (status = ANY (ARRAY['issued'::public.sheet_status, 'gfc'::public.sheet_status, 'ifc'::public.sheet_status, 'superseded'::public.sheet_status]))));

CREATE POLICY sheets_read_internal ON public.sheets FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY status_history_internal ON public.status_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.sheets s
  WHERE ((s.id = status_history.entity_id) AND (public.is_admin() OR public.has_internal_project_role(s.project_id))))));

ALTER TABLE public.submittals ENABLE ROW LEVEL SECURITY;

CREATE POLICY submittals_internal ON public.submittals FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

ALTER TABLE public.transmittal_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transmittal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY transmittal_items_internal ON public.transmittal_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.transmittals t
  WHERE (((t.id = transmittal_items.transmittal_id) AND (public.is_admin() OR public.has_internal_project_role(t.project_id))) OR (public.is_client_of_project(t.project_id) AND (t.sent_at IS NOT NULL))))));

ALTER TABLE public.transmittals ENABLE ROW LEVEL SECURITY;

CREATE POLICY transmittals_read ON public.transmittals FOR SELECT TO authenticated USING ((public.is_admin() OR public.has_internal_project_role(project_id)));

CREATE POLICY transmittals_read_client ON public.transmittals FOR SELECT TO authenticated USING (public.is_client_of_project(project_id));

ALTER TABLE public.user_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_capacity_read ON public.user_capacity FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_self ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY wa_event_settings_admin ON public.whatsapp_event_settings FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY wa_inbound_admin ON public.whatsapp_inbound FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY wa_outbox_admin ON public.whatsapp_outbox FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY wa_recipients_admin ON public.whatsapp_recipients FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.whatsapp_event_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_inbound ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_recipients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

\unrestrict 0ig6VHGkJvgUSJF5WljitfNGwdp4jfPGJg2wdX72lgSZlqkMJu9VhYxBRlBNLRH
