# Database Schema — Drawing Control & Alerts

**Status:** Draft. The DDL is in `schema.sql` in this folder. It has not been executed. It must be applied to a Supabase **staging** project and tested before anything else depends on it.
**Target:** Supabase Postgres 15 or later, India region.

---

## 1. Design principles

1. **Register at the centre.** Projects → sheets → revisions → files. Everything else links to a sheet, a revision or a project.
2. **Issued revisions are immutable.** A trigger blocks changes to any revision that is not `wip`, except the change from `issued` to `superseded`.
3. **Every change is an event.** The `events` table feeds alerts, the digest and the in-app bell. Each event records the rule version it was checked against.
4. **Audit is append-only.** `audit_log` has triggers that block update, delete and truncate.
5. **One user, many roles.** `user_roles` allows several roles on one project. Admin is firm-wide (`project_id` null). Combined roles are allowed (decision 41).
6. **Settings with overrides.** `settings` holds firm defaults (`project_id` null) and project overrides, using `NULLS NOT DISTINCT` (Postgres 15+).
7. **Time in UTC.** Display in IST in the application.
8. **Business rules in code, state rules in the database.** The database enforces integrity (uniqueness, immutability, required fields). The API enforces the lifecycle transitions and their guards, because the guards need data from several tables and produce plain-text reasons.

---

## 2. Tables by area

### 2.1 Identity and organisation

| Table | Purpose | Key columns / constraints |
|---|---|---|
| `client_orgs` | Hospital or other client organisation | `nda_required`, `nda_file_id`, `allow_aps_processing` (NDA viewing mode), `allow_native_download` (A-V1) |
| `profiles` | One row per user, id equals the Supabase auth user | `email` unique, `client_org_id` for client users, `is_active` |
| `projects` | Hospital projects | `code` unique (used in file names and transmittal numbers), `status` |
| `user_roles` | Roles per user per project | Unique (user, role, project). Admin only firm-wide. Client must have a project |
| `disciplines` | Seeded: ARC, STR, CIV, HVAC, ELE, PLB, FIR, MGS, ELV, MEP, LND, OTH | Codes used in file names and the register |
| `holidays` | Working-day calendar | `day` primary key |
| `settings` | SLAs, cap, digest time, naming and transmittal patterns | Unique (project, key), `NULLS NOT DISTINCT` |

**Seeded settings (firm defaults):**

| Key | Default | Source |
|---|---|---|
| `sla.internal_review_days` | 3 | Decision 6c |
| `sla.client_review_days` | 5 | Decision 6c |
| `sla.rfi_response_days` | 7 | Decision 6c |
| `sla.submittal_approval_days` | 10 | Decision 6c |
| `sla.conflict_reply_days` | 3 | Decision 26 |
| `approval.escalation_days` | 2 | Decision 14 |
| `whatsapp.daily_cap` | 30 | Decision 12 |
| `digest.time_local` | "09:00" | Decision 4 |
| `digest.timezone` | "Asia/Kolkata" | Decision 44 |
| `naming.file_pattern` | `{PROJECT}_{DISCIPLINE}_{SHEET}_{REV}` | Proposal 37 (A-N1) |
| `naming.transmittal_pattern` | `{PROJECT}-TR-{YYYYMM}-{NNN}` | Proposal 38 (A-T1) |

### 2.2 Register

| Table | Purpose | Notes |
|---|---|---|
| `sheets` | One row per drawing sheet | Unique (project, sheet_number). `status` is the lifecycle state. `is_live` is a generated column for the approval rule. `current_revision_id` points to the current revision |
| `revisions` | R0, R1… per sheet | Unique (sheet, seq) and (sheet, rev_code). `purpose` (issued, ifc, gfc) is set on issue. Immutable once issued |
| `files` | Stored files (originals and their APS status) | `storage_path` unique. `sha256` for the stale-revision check. `state` for upload and translation progress |
| `attachments` | Links a file to a conflict message, review comment, RFI, clash, change request or submittal | One file, one entity |
| `status_history` | Every state change of a sheet, clash, RFI and similar | Simple timeline view |
| `review_comments` | Comments on one revision | Open or closed, with resolution note |
| `change_requests` | Changes requested after issue | Cost and time impact fields |

### 2.3 Transmittals

| Table | Purpose | Notes |
|---|---|---|
| `transmittal_counters` | Monthly counter per project | Used by `next_transmittal_number()`, atomic upsert |
| `transmittals` | Packages sent out | Unique number, recipient (client org or text for contractor or consultant), `sent_at` |
| `transmittal_items` | Which revisions are in a transmittal | Composite primary key |

`next_transmittal_number(project_id)` returns the number in the format `{PROJECT CODE}-TR-{YYYYMM}-{NNN}`. The sequence resets each month per project. The pattern is fixed in the function for the pilot. If the admin changes the pattern in settings, the function must read it (noted in the SQL comments).

### 2.4 Issues

| Table | Purpose | Notes |
|---|---|---|
| `clashes` | Coordination clashes | Priority (critical, major, minor), two disciplines, owner, due date, `source_ref` for the Navisworks ID |
| `clash_sheets` | Clash to sheet links | Many to many |
| `rfis` | Contractor queries | Number unique per project, status, answer, deadline |
| `submittals` | Material and equipment approvals | Status with five values, deadline |
| `authority_checklists` | Items per authority (building sanction, fire NOC, AERB) | Status, responsible person, ticked by and when |

### 2.5 Approvals

| Table | Purpose | Notes |
|---|---|---|
| `approvals` | One row per approval request | `transition` names the change, `assignee_id` defaults to the project head, `due_at` is the escalation point, rejection needs a reason (check constraint) |

### 2.6 Conflicts

| Table | Purpose | Notes |
|---|---|---|
| `conflicts` | Client conflicts | Subject (1–200 characters), status (open, responded, awaiting_client, closed), `due_at` set when raised from the working-day rule |
| `conflict_messages` | The back-and-forth thread | Body 1–10,000 characters. Client and firm authors |

Attachments link through `attachments` with `entity_type = 'conflict_message'`.

### 2.7 Events, rules and notifications

| Table | Purpose | Notes |
|---|---|---|
| `events` | Every business change | `type`, `project_id`, entity reference, actor, JSON payload, `rule_version` |
| `rules` | Owner-defined rules (critical clash, critical RFI, critical revision, alert events) | `definition` in JSON, `version` incremented on change |
| `rule_versions` | History of each rule | Unique (rule, version). Rule changes apply to new events only (decision 19) |
| `notifications` | In-app bell entries | Per user, read timestamp |

### 2.8 WhatsApp

| Table | Purpose | Notes |
|---|---|---|
| `whatsapp_recipients` | Owner and the 3–4 internal people | `opted_in`, `opt_in_confirmed_at` (written confirmation), `opted_out_at` (STOP) |
| `whatsapp_event_settings` | Which event types send on WhatsApp | Admin toggles (decision 11) |
| `whatsapp_outbox` | Every outgoing message | `dedupe_key` unique, status, attempts, `next_attempt_at`, `body_preview` for audit |
| `whatsapp_inbound` | Every incoming message | `is_allowed` false for numbers not on the allowlist |
| `digests` | Each digest, deterministic and AI text | `ai_validated` and `ai_rejection_reason` show when the fallback was used |

### 2.9 Import, export, audit

| Table | Purpose | Notes |
|---|---|---|
| `register_imports` | Each Excel import | Row counts, error list (JSON), confirmation |
| `exports` | Project export archives | Storage path, SHA-256, expiry |
| `audit_log` | Append-only record of user actions | Triggers block update, delete and truncate |

---

## 3. Key constraints and triggers

| Rule | Where enforced |
|---|---|
| Sheet number unique per project | `sheets` unique constraint |
| Revision codes unique per sheet | `revisions` unique constraints |
| Issued revisions immutable | `revisions_immutable` trigger |
| Superseded stays superseded | `revisions_immutable` trigger |
| Issued revision has issue date and issuer | `revisions_issued_fields` check |
| Admin is firm-wide, others per project | `user_roles_admin_is_firmwide` check |
| Rejection requires a reason | `approvals_rejection_reason` check |
| Audit log is append-only | `audit_no_update_delete` and `audit_no_truncate` triggers |
| Transmittal numbers unique and sequential per month | `transmittals.number` unique, counter upsert in function |
| Transition guards (critical clashes open, checker sign-off, transmittal exists) | API layer (not in the database), with plain-text error messages |
| Working days for SLAs | Worker code, using `holidays` (weekend pattern to confirm, O-A1) |
| Client sees only issued revisions | RLS, plus restricted views (section 6) |

---

## 4. Lifecycle state values

`sheet_status` values and their meaning:

| Value | Meaning | Live? |
|---|---|---|
| `not_started` | Created, no work yet | No |
| `assigned` | Owner set | No |
| `wip` | Drafting | No |
| `internal_check` | Waiting for checker | No |
| `coordination` | Waiting for clash resolution | No |
| `approved` | Checker signed off, not yet issued | No |
| `issued` | Issued to client or contractor | **Yes** |
| `client_review` | Client is reviewing | No |
| `commented` | Client or reviewer comments received | No |
| `revised` | New revision in progress after comments | No |
| `gfc` | Good for construction | **Yes** |
| `ifc` | Issued for construction | **Yes** |
| `superseded` | Replaced by a newer issued revision | No |

**Live** means changes need project-head approval (decision 6d).

The UI label for `wip` is "In progress" (DESIGN.md, section 8). The code value stays `wip`.

---

## 5. Indexes

| Index | Serves |
|---|---|
| `sheets (project_id, status)` | Register filters, dashboard counts |
| `sheets (owner_id)` | "My sheets" |
| `sheets (due_date)` | Overdue and due-today lists |
| `revisions (sheet_id)` | Revision timeline |
| `files (sheet_id)` | Files tab |
| `approvals (assignee_id, status)` | "My approvals" and bell count |
| `conflicts (project_id, status, due_at)` | Overdue conflicts |
| `clashes (project_id, status, priority)` | Critical clash lists |
| `rfis (project_id, status, due_date)` | Overdue RFIs |
| `events (project_id, created_at desc)` and `events (type, created_at desc)` | Digest windows, activity |
| `whatsapp_outbox (status, next_attempt_at)` | Outbox sender polling |
| `notifications (user_id, read_at)` | Bell |

Add more indexes after measuring real queries in the pilot. Do not add them speculatively.

---

## 6. Row Level Security

### 6.1 Principles

- RLS is enabled on every table (done in `schema.sql`).
- **End-user roles have no insert, update or delete policies on business tables.** All business writes go through API functions that check the transition rules and write the event and the audit record in one transaction.
- **Clients read through views**, not base tables. A client sees only:
  - issued revisions (status `issued`, `gfc`, `ifc`) and their files, for projects linked to them;
  - the transmittals they received;
  - their own conflicts and the messages in them.
- **Worker and API use the service role**, which bypasses RLS. Every query in that code must check project and recipient explicitly. This is a code review rule and is tested.

### 6.2 Policy outline (to write and test in Phase 1)

| Table | Read | Write |
|---|---|---|
| `projects` | Admin, or any internal role on the project, or a client of the project | Admin only, via API |
| `user_roles` | Admin, or the user themselves | Admin only, via API |
| `sheets` | Admin, or internal role on the project | Via API only |
| `revisions` | Internal roles on the project. Clients: issued family only, via view | Via API only |
| `files` | Internal roles on the project. Clients: files of issued revisions, via view | Via API only; upload URL issued by API |
| `approvals` | Requester, assignee, admin | Via API only |
| `conflicts` and `conflict_messages` | Client of the project (own org), internal roles on the project | Client may create and reply on own conflicts. Firm replies via API |
| `whatsapp_recipients` | Admin | Admin only |
| `whatsapp_outbox` | Admin | Worker only (service role) |
| `whatsapp_inbound` | Admin | Worker only |
| `digests` | Admin, and the recipient | Worker only |
| `events` | Internal roles on the project, admin | Via API and worker only |
| `notifications` | The user only | Via API and worker only |
| `audit_log` | Admin | Append-only, via triggers |
| `exports` | Admin | Admin via API, worker builds |
| `settings` | Admin | Admin via API |
| `rules`, `rule_versions` | Admin (and project heads if Q-P4 says so) | Admin via API |

### 6.3 Client views (to create in Phase 5)

- `client_sheet_view`: sheets joined to their current issued revision, for projects linked to the client.
- `client_file_view`: files linked to issued revisions only, with a signed download URL generated by the API.
- `client_transmittal_view`: transmittals sent to the client's organisation.

---

## 7. Storage layout

| Bucket | Contents | Access |
|---|---|---|
| `drawings` (private) | Original files, path `{project_code}/{sheet_number}/{rev}/{filename}` | Signed URLs only, from API |
| `attachments` (private) | Conflict and review attachments | Signed URLs only |
| `exports` (private) | Encrypted export archives | Admin signed URL, short expiry |
| `nda` (private) | Client NDA files | Admin and the client org's users |

No public buckets.

---

## 8. Data lifecycle

| Data | Kept | Deleted |
|---|---|---|
| Issued revisions and their files | While the project exists, and as the retention rule (EXP-06) requires | With the project, after export |
| Superseded revisions | Same as issued | Same |
| Audit log | While the project exists, and as retention requires | With the project only after export. Audit rows of the deletion itself are kept |
| WhatsApp outbox and inbound logs | 12 months (proposed) | Automated cleanup job |
| Digests | 12 months (proposed) | Automated cleanup job |
| Events | While the project exists | With the project |
| APS copies of source files | Deleted when the revision is superseded and no longer needed for viewing (O-A7) | Worker job |

Retention periods marked "proposed" need owner confirmation.

---

## 9. Migration plan

1. Apply `schema.sql` to the staging Supabase project.
2. Load the seed data: disciplines and settings (included in the file).
3. Create the admin profile (the owner) and the firm-wide admin role.
4. Import a test register using the Excel template to check the import path.
5. Run the RLS test suite: each role, each table, read and write attempts. Expected results are written before running.
6. Only then apply to production, after a backup, in a maintenance window agreed with the owner.

Future changes: versioned migration files under `supabase/migrations/`, each reviewed and tested on staging first.

---

## 10. Open schema questions

| ID | Question | Affects |
|---|---|---|
| O-A1 | Weekend pattern and holiday list | `holidays` data, SLA calculation |
| Q-P4 | Who can see rule history | `rule_versions` policy |
| Q-P6 | Whether clients get email for responses | `notifications`, email settings |
| Q-P7 | Whether dashboard charts are needed | Views and indexes |
| O-T3 | Export archive format | `exports` columns |
| A-N1 and A-T1 | Naming and transmittal patterns | `settings` values, `next_transmittal_number` |
