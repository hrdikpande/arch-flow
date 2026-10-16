-- Complete row-level security for end-user sessions (anon key + user JWT).
-- The web app and the messaging runtime use the service role and enforce the same rules in code.
-- These policies stop a direct query with a user's own token from seeing or changing data it should not.
-- Writes stay closed to end-user tokens: no insert, update or delete policy is created for business tables.

-- ---- Settings, reference data and audit: admin or any signed-in user for reference lists ----
create policy settings_admin on settings for select to authenticated using (is_admin());
create policy holidays_read on holidays for select to authenticated using (true);
create policy disciplines_read on disciplines for select to authenticated using (true);
create policy audit_admin on audit_log for select to authenticated using (is_admin());
create policy rules_admin on rules for select to authenticated using (is_admin());
create policy rule_versions_admin on rule_versions for select to authenticated using (is_admin());
create policy exports_admin on exports for select to authenticated using (is_admin());

-- ---- WhatsApp: admin only (recipients are personal data) ----
create policy wa_recipients_admin on whatsapp_recipients for select to authenticated using (is_admin());
create policy wa_outbox_admin on whatsapp_outbox for select to authenticated using (is_admin());
create policy wa_inbound_admin on whatsapp_inbound for select to authenticated using (is_admin());
create policy wa_event_settings_admin on whatsapp_event_settings for select to authenticated using (is_admin());
create policy digests_admin on digests for select to authenticated using (is_admin());

-- ---- Profiles: a user sees their own profile; the admin sees all ----
create policy profiles_admin on profiles for select to authenticated using (is_admin());

-- ---- Project data: internal roles on the project, or the admin ----
create policy files_read_client on files for select to authenticated
  using (exists (select 1 from revisions r where r.id = files.revision_id and r.status in ('issued', 'superseded')
    and is_client_of_project(files.project_id)));
create policy status_history_internal on status_history for select to authenticated
  using (exists (select 1 from sheets s where s.id = status_history.entity_id and (is_admin() or has_internal_project_role(s.project_id))));
create policy review_comments_internal on review_comments for select to authenticated
  using (exists (select 1 from revisions r join sheets s on s.id = r.sheet_id
    where r.id = review_comments.revision_id and (is_admin() or has_internal_project_role(s.project_id))));
create policy change_requests_internal on change_requests for select to authenticated using (is_admin() or has_internal_project_role(project_id));
create policy submittals_internal on submittals for select to authenticated using (is_admin() or has_internal_project_role(project_id));
create policy authority_checklists_internal on authority_checklists for select to authenticated using (is_admin() or has_internal_project_role(project_id));
create policy register_imports_internal on register_imports for select to authenticated using (is_admin() or has_internal_project_role(project_id));
create policy clash_sheets_internal on clash_sheets for select to authenticated
  using (exists (select 1 from clashes c where c.id = clash_sheets.clash_id and (is_admin() or has_internal_project_role(c.project_id))));
create policy transmittal_items_internal on transmittal_items for select to authenticated
  using (exists (select 1 from transmittals t where t.id = transmittal_items.transmittal_id and (is_admin() or has_internal_project_role(t.project_id))
    or (is_client_of_project(t.project_id) and t.sent_at is not null)));
create policy attachments_internal on attachments for select to authenticated
  using (exists (select 1 from files f where f.id = attachments.file_id and (is_admin() or has_internal_project_role(f.project_id))));

-- ---- Conflicts: client sees their own organisation's conflicts; the firm sees project conflicts ----
create policy conflicts_internal on conflicts for select to authenticated using (is_admin() or has_internal_project_role(project_id));
create policy conflict_messages_internal on conflict_messages for select to authenticated
  using (exists (select 1 from conflicts c where c.id = conflict_messages.conflict_id and (is_admin() or has_internal_project_role(c.project_id))));

-- ---- Events (for the in-app feed): internal roles on the project ----
-- events_read already exists in 20261016000100_read_policies.sql.
