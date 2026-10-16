-- Read policies for end-user sessions (defence in depth).
-- The web app and the messaging routes read with the service role and enforce the same
-- rules in code (see apps/web/src/lib/access.ts). These policies make a direct
-- query with a user's own token return only what that user may see.
-- Writes stay closed to end-user tokens: no insert/update/delete policies are created.

-- Users can read their own roles and profile.
create policy user_roles_self on user_roles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_self on profiles for select to authenticated
  using (id = auth.uid());

-- Internal roles and admins read project data.
create policy projects_read on projects for select to authenticated
  using (is_admin() or has_internal_project_role(id));
create policy revisions_read_internal on revisions for select to authenticated
  using (exists (select 1 from sheets s where s.id = revisions.sheet_id
                 and (is_admin() or has_internal_project_role(s.project_id))));
create policy files_read_internal on files for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));
create policy approvals_read on approvals for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));
create policy clashes_read on clashes for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));
create policy rfis_read on rfis for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));
create policy transmittals_read on transmittals for select to authenticated
  using (is_admin() or has_internal_project_role(project_id));
create policy events_read on events for select to authenticated
  using (is_admin() or (project_id is not null and has_internal_project_role(project_id)));

-- Clients see only issued revisions and files of their linked projects.
create policy sheets_read_client on sheets for select to authenticated
  using (is_client_of_project(project_id) and status in ('issued', 'gfc', 'ifc', 'superseded'));
create policy revisions_read_client on revisions for select to authenticated
  using (status in ('issued', 'superseded') and exists (
    select 1 from sheets s where s.id = revisions.sheet_id and is_client_of_project(s.project_id)));
create policy transmittals_read_client on transmittals for select to authenticated
  using (is_client_of_project(project_id));
create policy conflicts_read_client on conflicts for select to authenticated
  using (is_client_of_project(project_id) and client_org_id = (select client_org_id from profiles where id = auth.uid()));
create policy conflict_messages_read_client on conflict_messages for select to authenticated
  using (exists (select 1 from conflicts c where c.id = conflict_messages.conflict_id
                 and c.client_org_id = (select client_org_id from profiles where id = auth.uid())));
create policy notifications_read_own on notifications for select to authenticated
  using (user_id = auth.uid());
