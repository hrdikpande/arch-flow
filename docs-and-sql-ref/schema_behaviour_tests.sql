\set ON_ERROR_STOP 0
-- setup
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into profiles (id, full_name, email) values ('00000000-0000-0000-0000-000000000001','Owner','owner@example.com');
insert into projects (id, code, name) values ('00000000-0000-0000-0000-0000000000a1','NRH-BLR-01','Test project');
insert into sheets (id, project_id, sheet_number, title, discipline_code) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','M-101','HVAC GF','HVAC');
insert into revisions (id, sheet_id, rev_code, seq, status, purpose, issued_at, issued_by) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','R0',0,'issued','issued',now(),'00000000-0000-0000-0000-000000000001');

\echo '--- T1 expect ERROR: issued revision immutable'
update revisions set title_dummy = 1 where false;
update revisions set seq = 5 where id='00000000-0000-0000-0000-0000000000c1';

\echo '--- T2 expect ERROR: audit log append-only'
insert into audit_log (actor_id, action) values ('00000000-0000-0000-0000-000000000001','test');
update audit_log set action='tampered';
delete from audit_log;

\echo '--- T3 expect ERROR: admin must be firm-wide (project_id null)'
insert into user_roles (user_id, role, project_id) values ('00000000-0000-0000-0000-000000000001','admin','00000000-0000-0000-0000-0000000000a1');

\echo '--- T4 expect ERROR: non-admin must have project'
insert into user_roles (user_id, role, project_id) values ('00000000-0000-0000-0000-000000000001','drafter',null);

\echo '--- T5 expect success: admin firm-wide'
insert into user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000001','admin');

\echo '--- T6 expect ERROR: settings duplicate firm default (NULLS NOT DISTINCT)'
insert into settings (project_id, key, value) values (null,'sla.internal_review_days','5');

\echo '--- T7 expect ERROR: rejected approval needs reason'
insert into approvals (project_id, entity_type, entity_id, transition, requested_by, assignee_id, status, due_at)
  values ('00000000-0000-0000-0000-0000000000a1','sheet','00000000-0000-0000-0000-0000000000b1','x','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','rejected', now());

\echo '--- T8 expect ERROR: revision issued fields required'
insert into revisions (sheet_id, rev_code, seq, status) values ('00000000-0000-0000-0000-0000000000b1','R9',9,'issued');

\echo '--- T9 expect success: transmittal numbers, sequential'
select next_transmittal_number('00000000-0000-0000-0000-0000000000a1');
select next_transmittal_number('00000000-0000-0000-0000-0000000000a1');

\echo '--- T10 expect: is_live true for issued sheet after issue, false for wip'
update sheets set status='issued' where id='00000000-0000-0000-0000-0000000000b1';
select sheet_number, status, is_live from sheets;
update sheets set status='wip' where id='00000000-0000-0000-0000-0000000000b1';
select sheet_number, status, is_live from sheets;

\echo '--- T11 expect ERROR: duplicate sheet number in project'
insert into sheets (project_id, sheet_number, title, discipline_code) values ('00000000-0000-0000-0000-0000000000a1','M-101','dup','HVAC');

\echo '--- T12 expect ERROR: revision code format'
insert into revisions (sheet_id, rev_code, seq) values ('00000000-0000-0000-0000-0000000000b1','X1',3);

\echo '--- T13 expect ERROR: superseded cannot change status back'
update revisions set status='superseded' where id='00000000-0000-0000-0000-0000000000c1';
update revisions set status='issued' where id='00000000-0000-0000-0000-0000000000c1';
