# Build status (16 Oct 2026)

| Area | IDs | Status | Notes |
|---|---|---|---|
| Accounts and roles | AUTH, CLI-09 | Built | Magic link invitation, password login. Password reset and session timeout depend on Supabase Auth settings. |
| Projects and settings | PRJ, SET | Built | SLA defaults and overrides; capacity per person (workload page). |
| Register and import | REG, IMP | Built | Template import with a review step before anything is written. Revision-history sheet imported with the newest-issued rule. |
| Lifecycle and revisions | LIFE, REV | Built | Guards as in LIFE-02 to LIFE-08. Database blocks edits to issued revisions. |
| Files and viewing | FIL, VIEW | Built, not live-tested | PDF viewer. CAD viewer via APS. Translation status and retry. APS endpoints need live verification. |
| Review comments | RVW | Built | Add and resolve on the sheet page. |
| Approvals | APR | Built | Request, approve, reject, escalation on the daily pass. |
| Clashes | CLS | Built | Import with source-reference duplicate check. Format awaits a sample export. |
| RFIs | RFI | Built | Overdue check and WhatsApp notice. |
| Submittals | SUB | Built | Create and update status; overdue flagged on the page. |
| Changes | CHG | Built | Request with cost and time impact; approval links to the change. |
| Authority checklists | AUT | Built | Admin template; project checklist; overdue flag. |
| Transmittals | TRN | Built | Issued revisions only. Mark as sent. Email is not sent by the system. |
| Workload | WKL | Built | Admin view with capacity. |
| Dashboards and reports | DSH, REG-07, CHG-03 | Built | PDF and Excel exports from `/api/reports/[report]`. |
| Client portal | CLI, CFL | Built, not live-tested | Conflict threads and issued drawing views. RLS tests cover client isolation. |
| Notifications | NTF | Built | In-app notifications. |
| WhatsApp alerts | WA | Built on Cloud API | Needs Meta credentials, a test number and an approved template. Inbound commands via webhook. |
| Digest | DIG | Built | Deterministic text always works. Gemini wording needs a key. |
| Critical rules | RUL | Built | Draft rules until the owner edits them. |

Items marked "not live-tested" have unit or database tests but have not been run against a real Supabase project, WhatsApp number or Autodesk account.

---

# Feature Inventory — Drawing Control & Alerts

**Version:** 2.0
**Status:** Draft for owner approval
**Companion:** PRD.md (requirements summary), SCHEMA.md, ARCHITECTURE.md, BUILD-PHASES.md

This is the complete feature list for the pilot. Each feature has an ID, a priority, the roles that can use it, and acceptance criteria. An acceptance criterion is a test: if it's true, the feature works.

---

## 1. Conventions

**Priority**
- **P0**: needed for the pilot to run. Pilot cannot start without it.
- **P1**: part of "all modules" for the pilot (decision A3). Build in the pilot phase, but the pilot can start if a P1 item is late and the owner agrees.
- **P2**: after the pilot. Not built now.

**Role abbreviations**
- **AD** Admin (owner)
- **PH** Project head
- **DL** Discipline lead
- **DR** Drafter
- **CK** Checker
- **CL** Client

**Feature IDs** use a module prefix and two digits. The same IDs appear in PRD.md, the build phases and the test plan.

---

## 2. Roles and permissions

| Action | AD | PH | DL | DR | CK | CL |
|---|---|---|---|---|---|---|
| Create project | ✔ | | | | | |
| Edit project settings and SLAs | ✔ | ✔ (own project, if admin allows) | | | | |
| Create user accounts | ✔ | | | | | |
| Assign roles | ✔ | | | | | |
| Create and edit sheets | ✔ | ✔ | ✔ | ✔ | | |
| Assign owner and due date | ✔ | ✔ | ✔ | | | |
| Move sheet through internal states | ✔ | ✔ | ✔ | ✔ (own sheets) | ✔ (check steps) | |
| Internal check sign-off | ✔ | ✔ | ✔ | | ✔ | |
| Approve changes to live sheets | ✔ | ✔ (default approver) | | | | |
| Issue a revision | ✔ | ✔ | | | ✔ (with PH) | |
| Upload files | ✔ | ✔ | ✔ | ✔ | | |
| View internal files | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Download native CAD (internal) | ✔ | ✔ | ✔ | ✔ | ✔ | |
| View and download issued files (client) | | | | | | ✔ |
| Raise conflicts | | | | | | ✔ |
| Respond to conflicts | ✔ | ✔ | | ✔ (sheet's drafter) | | |
| Create transmittals | ✔ | ✔ | | | | |
| Export and delete project | ✔ | | | | | |
| Change WhatsApp settings | ✔ | | | | | |
| Use WhatsApp commands | ✔ (if in group) | ✔ (if in group) | ✔ (if in group) | | | |
| Edit critical rules | ✔ | | | | | |
| View audit log | ✔ | | | | | |

**Rule:** a person with several roles on a project has the union of permissions (decision 41). The dashboard combines their views.

**Responders (decision, to confirm A-R1):** for conflicts, transmittals and approvals, a project head may act, and so may a drafter on the affected sheet.

---

## 3. Feature list

### 3.1 Authentication and accounts (AUTH)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| AUTH-01 | Account invitation by admin | P0 | AD | Admin creates an account with name, email and roles. An email with a magic link is sent. The link opens a password setup page and expires in 24 hours. |
| AUTH-02 | Password login | P0 | All | User signs in with email and password. Wrong password 5 times in 15 minutes shows a delay message. |
| AUTH-03 | Password reset | P0 | All | "Forgot password" sends a magic link. The link works once and expires in 1 hour. |
| AUTH-04 | Session timeout | P0 | All | Session length as set in O-A2. After timeout, user returns to login with the page they were on kept in the URL. |
| AUTH-05 | Deactivate user | P0 | AD | Deactivated user cannot sign in. Their history stays. Their open approvals return to the admin. |
| AUTH-06 | No self-registration | P0 | All | The sign-up page does not exist. Only invitation links work. |

### 3.2 Projects (PRJ)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| PRJ-01 | Create project | P0 | AD | Fields: code (unique, uppercase, letters, digits and hyphens), name, client organisation, start date. Code cannot change after the first sheet is created. |
| PRJ-02 | Edit project | P0 | AD, PH | Changes are audited. |
| PRJ-03 | Assign people to project | P0 | AD | A person can hold several roles. Removing a role does not delete their past actions. |
| PRJ-04 | Project list and detail | P0 | AD, PH, DL, DR, CK | Lists only projects where the user has a role. Admin sees all. |
| PRJ-05 | Close project | P1 | AD | Closed projects are read-only. Clients keep read access. |
| PRJ-06 | Project status | P1 | AD | Active, on hold, closed. Shown on the project card. |

### 3.3 Settings and SLAs (SET)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| SET-01 | Firm default SLAs | P0 | AD | Defaults: internal review 3, client review 5, RFI response 7, submittal approval 10, conflict reply 3, approval escalation 2 (working days). Editable. |
| SET-02 | Project SLA overrides | P0 | AD | Each project can override any SLA. An override shows "project setting" next to the value. Clearing it returns to the firm default. |
| SET-03 | Naming pattern | P0 | AD | Pattern as in settings. Changes apply to new uploads only. Existing file names are not changed. |
| SET-04 | Transmittal pattern | P0 | AD | Pattern as in settings, applied to the next transmittal. Changing the pattern after the first transmittal shows a warning. |
| SET-05 | Daily WhatsApp cap | P0 | AD | Integer between 1 and 200. Default 30. |
| SET-06 | Digest time and timezone | P0 | AD | Time in 24-hour format, timezone fixed to IST for the pilot. |
| SET-07 | Capacity per person | P1 | AD, PH | Number of sheets and hours per week per person. Used by WKL. |
| SET-08 | Working-day calendar | P0 | AD | Holidays list and weekend pattern (O-A1). Changes apply to new calculations and show the affected deadlines. |

### 3.4 Register (REG)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| REG-01 | Register list | P0 | Internal | Columns: project, sheet number, title, discipline, revision, state, owner, due date. Sort on every column. Filters: project, discipline, state, owner, overdue. Search by sheet number or title. Paged at 50 rows. |
| REG-02 | Create sheet | P0 | AD, PH, DL, DR | Sheet number unique within project (error message names the existing sheet). Discipline required. Creates revision R0 in state WIP. |
| REG-03 | Edit sheet details | P0 | AD, PH, DL | Title, discipline, owner, due date. Each change is audited. Discipline change on an issued sheet needs approval (APR). |
| REG-04 | Sheet detail page | P0 | Internal | Tabs: Overview, Revisions, Files, Review, Issues, History. Header shows sheet number, current revision and state. |
| REG-05 | Sheet state change | P0 | Per guards | See LIFE. |
| REG-06 | Duplicate sheet | P2 | | Not in pilot. |
| REG-07 | Register export (Excel, PDF) | P1 | AD, PH | Export of the current filter. File name includes project code and date. |

### 3.5 Register import (IMP)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| IMP-01 | Download template | P0 | AD, PH | Download of `drawing_register_template.xlsx`. |
| IMP-02 | Upload import file | P0 | AD, PH | Accepts .xlsx only, max size per plan. Rejects other types with a message. |
| IMP-03 | Validation preview | P0 | AD, PH | Preview shows counts (total, OK, failed) and a table of failed rows with the reason per row. Nothing is saved yet. |
| IMP-04 | Validation rules | P0 | | Project code exists and user has access. Sheet number unique and not already in the project. Discipline and status from the dropdown lists. Owner email exists as an active user. Due date valid, format YYYY-MM-DD. |
| IMP-05 | Confirm import | P0 | AD, PH | Writes all OK rows in one transaction. Failed rows are not written. User can download the failed rows as a new file. |
| IMP-06 | Import log | P0 | AD, PH | Each import records who, when, row counts and errors. |

### 3.6 Lifecycle (LIFE)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| LIFE-01 | State machine | P0 | | The 13 states in SCHEMA.md, section 4. Only allowed transitions can be made. Others are not offered in the UI and rejected by the API. |
| LIFE-02 | Assigned requires owner | P0 | | Moving to Assigned without an owner returns "Set an owner before assigning this sheet." |
| LIFE-03 | Internal check requires checker | P0 | | Sending to internal check requires a checker on the discipline. Checker is notified. |
| LIFE-04 | Approved requires checker sign-off | P0 | CK | Only the checker can sign off. Sign-off records name and time. |
| LIFE-05 | Issue guards | P0 | AD, PH, CK | Issue is blocked unless: checker sign-off recorded, zero open critical clashes on the sheet, transmittal created, next revision in sequence. Each blocked reason is listed by name. |
| LIFE-06 | Change to live sheet | P0 | Any internal | Any change to a sheet in issued, GFC or IFC state creates an approval request (APR-01). The sheet does not change until approved. |
| LIFE-07 | Rejection returns to WIP | P0 | PH | Rejection with reason returns the sheet to WIP. The reason is shown to the drafter. |
| LIFE-08 | Blocked action explanation | P0 | | Any blocked action shows the rule, the count and what to do. Example: "You can't issue M-101 yet. It has 1 open critical clash (CL-044). Resolve it or ask the project head to review it." |
| LIFE-09 | State history | P0 | Internal | Every change appears in the sheet's History tab with time, actor, from and to, and note. |

### 3.7 Revisions (REV)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| REV-01 | Create revision | P0 | AD, PH, DL, DR | Next sequence number is automatic. Starts in WIP. |
| REV-02 | Issue revision | P0 | Per LIFE-05 | Sets purpose (issued, IFC or GFC). Previous issued revision becomes superseded in the same transaction. |
| REV-03 | Immutable issued revision | P0 | | Attempts to change an issued revision's content are blocked by the database and shown as "This revision is issued and cannot be changed. Create a new revision." |
| REV-04 | Revision timeline | P0 | Internal, client (issued only) | Shows each revision: code, date, who issued it, purpose, status, transmittal. |
| REV-05 | Supersession | P0 | | Superseded revisions are labelled and cannot be sent in new transmittals (TRN-01). |

### 3.8 Files and naming (FIL)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| FIL-01 | Upload file | P0 | AD, PH, DL, DR | Accepts PDF, DWG, RVT, IFC, NWD. Large files upload with resume after connection loss. Progress bar shows percentage and bytes. |
| FIL-02 | File size limit | P0 | | Limit from the Supabase plan (O-A9), shown before upload starts. |
| FIL-03 | Naming check | P0 | | On upload the file name is compared with the pattern. Mismatch shows a warning with the suggested name. The user may keep the original name, and the warning is recorded. |
| FIL-04 | Checksum | P0 | | SHA-256 stored after upload. Shown in file details. |
| FIL-05 | Stale-revision check | P0 | | If a file for an issued revision is replaced, or its checksum differs from the one recorded at issue, a stale-revision flag is raised and the owner is alerted. This is the basis of the pilot measure. |
| FIL-06 | Download | P0 | Per role | Internal users download per role. Clients download issued revisions only, if the client org allows native download (A-V1). |
| FIL-07 | Delete file | P0 | AD | Only for files on wip revisions. Issued file cannot be deleted. Deletion audited. |
| FIL-08 | Upload alert | P0 | | Every upload creates an event for WhatsApp (WA-02). |

### 3.9 Viewing (VIEW)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| VIEW-01 | PDF viewer | P0 | Per role | Opens in the browser. Zoom, page navigation, fit width. Keyboard usable. |
| VIEW-02 | Autodesk viewer | P0 | Internal; clients if NDA allows | Opens DWG, RVT, IFC, NWD after translation. Shows loading state and an error message with a retry. |
| VIEW-03 | Translation status | P0 | Internal | File shows state: stored, translating, translated, failed. Failed files offer a retry (up to 3 attempts). |
| VIEW-04 | Fallback when viewing fails | P0 | | If a native file can't be viewed, the user sees the download option and the reason. |
| VIEW-05 | NDA viewing mode | P0 | | If the client org's NDA disallows APS processing, native files for that client are download-only, and PDF is viewable. The internal team is unaffected. |

### 3.10 Review comments (RVW)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| RVW-01 | Add comment to revision | P1 | DL, CK, PH, DR | Comment text, optional attachment. Stored against the revision. |
| RVW-02 | Resolve comment | P1 | Author of the sheet's revision | Resolution note required. Status changes to closed. |
| RVW-03 | Comment count | P1 | | Count of open comments shows on sheet cards. |

### 3.11 Approvals (APR)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| APR-01 | Request approval | P0 | Any internal | Request names the transition, the sheet, the reason and the due date. Assignee defaults to the project head. |
| APR-02 | Approval card | P0 | Assignee | Shows what is requested, who requested it, due date, and the change summary. |
| APR-03 | Approve | P0 | Assignee | Approval records name and time. The change happens in the same transaction. |
| APR-04 | Reject | P0 | Assignee | Text reason required. Sheet returns to WIP (LIFE-07). Requester notified. |
| APR-05 | Escalation | P0 | System | Pending after the escalation days (SET-01, default 2 working days) → owner notified in-app and on WhatsApp, if the event is selected (WA-02). Escalated once; the escalation is recorded. |
| APR-06 | Self-approval recorded | P0 | | A person who performed a step can also approve it if they hold the role (decision 41). The audit trail flags it as "same person" on the approval. |
| APR-07 | Who can see approvals | P0 | | Assignee, requester, admin. |
| APR-08 | My approvals | P0 | Any internal | List of open approvals assigned to the user, oldest first. Count shows in the navigation. |
| APR-09 | Approval history | P0 | Internal | Full history per sheet. |

### 3.12 Clashes (CLS)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| CLS-01 | Create clash | P0 | DL, PH, AD | Number unique per project, title, description, priority, two disciplines, linked sheets, owner, due date. |
| CLS-02 | Critical flag | P0 | | Priority is set from the owner's critical rules (RUL). A clash that matches a critical rule is flagged critical automatically. |
| CLS-03 | Resolve clash | P0 | Owner or DL | Resolution note required. Status resolved. Closed after the discipline lead confirms. |
| CLS-04 | Import clash report | P1 | AD, PH, DL | Format per O1. Preview as in IMP-03. Duplicates by source reference are skipped and reported. |
| CLS-05 | Clash list | P0 | Internal | Filters: project, priority, status, discipline, age. |
| CLS-06 | Clash overdue | P0 | | Clash past due date shows as overdue on the dashboard. |

### 3.13 RFIs (RFI)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| RFI-01 | Create RFI | P0 | AD, PH, DL, DR | Number unique per project, subject, body, linked sheet, priority, assignee, due date (default 7 working days, SET-01). |
| RFI-02 | Respond to RFI | P0 | Assignee | Answer required. Status answered. Requester notified. |
| RFI-03 | Close RFI | P0 | Requester or PH | Closed RFIs are read-only. |
| RFI-04 | RFI overdue | P0 | System | Past due date and not answered → overdue on dashboard. Owner alerted via WA-02 if selected. |

### 3.14 Submittals (SUB)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| SUB-01 | Create submittal | P1 | DL, PH, DR | Number unique per project, item, linked sheet, due date (default 10 working days). |
| SUB-02 | Update submittal status | P1 | DL, PH | Statuses: submitted, under review, approved, approved with comments, rejected. Each change dated. |
| SUB-03 | Submittal overdue | P1 | System | Overdue if past due and not approved or rejected. Shown on dashboard and in digest. |

### 3.15 Change tracking (CHG)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| CHG-01 | Request change | P1 | DL, PH | Reason required. Optional cost and time impact (days). Linked to sheet and revision. |
| CHG-02 | Change approval | P1 | PH | Uses APR. Approved change moves to implemented when a new revision is issued. |
| CHG-03 | Change report | P1 | AD, PH | List of changes per project with cost and time totals. Exported with REG-07. |

### 3.16 Authority checklists (AUT)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| AUT-01 | Checklist template | P1 | AD | Admin creates items per authority (for example Building sanction, Fire NOC, AERB). Templates reused across projects. |
| AUT-02 | Project checklist | P1 | AD, PH | Template copied to a project, with responsible person and due date per item. |
| AUT-03 | Tick item | P1 | Responsible person | Status: pending, submitted, approved, not applicable. Date and person recorded. |
| AUT-04 | Checklist overdue | P1 | System | Required item past due and not approved → overdue on dashboard and in digest. |

### 3.17 Transmittals (TRN)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| TRN-01 | Create transmittal | P0 | AD, PH | Select issued revisions only. Superseded revisions cannot be selected. Recipient selected (client org or free text for contractor or consultant). |
| TRN-02 | Transmittal number | P0 | | Generated per SET-04. Unique. Shown on the transmittal and in the revision timeline. |
| TRN-03 | Mark as sent | P0 | AD, PH | Records sent date and time. The system does not email the transmittal (see Q-P9). |
| TRN-04 | Transmittal history | P0 | AD, PH, CL (own org) | List with number, date, recipient and revision count. Clients see only transmittals sent to them. |
| TRN-05 | Transmittal detail | P0 | AD, PH, CL (own org) | Lists revisions included, with download for clients where allowed (FIL-06). |

### 3.18 Workload (WKL)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| WKL-01 | Workload view | P1 | AD, PH, DL | Per person: open sheets, hours if recorded, capacity (SET-07), percentage. |
| WKL-02 | Over-capacity flag | P1 | System | Person over capacity for a week is flagged. Shown on dashboard and in the weekly summary (WA-02 if selected). |

### 3.19 Dashboards (DSH)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| DSH-01 | Owner dashboard | P0 | AD | Tiles: overdue sheets, overdue reviews, overdue RFIs, overdue submittals, overdue client conflicts, critical open clashes, pending approvals, stale-revision flags. Each tile links to the filtered list. |
| DSH-02 | Issue age | P0 | AD, PH | Open issues by age: 0–7, 8–14, 15+ days. |
| DSH-03 | Role home | P0 | All internal | Shows the user's own items first: my sheets, my approvals, my RFIs, my conflicts. |
| DSH-04 | Project dashboard | P0 | PH, DL | Same tiles as DSH-01, filtered to the project. |
| DSH-05 | Charts | P2 | | Only if Q-P7 says yes. |
| DSH-06 | Pilot measures panel | P0 | AD | Shows the three pilot measures (stale-revision incidents, overdue RFIs, owner reporting time entry) with baseline and target. |

### 3.20 Client portal (CLI)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| CLI-01 | Client invitation | P0 | AD | Admin creates a client user for a client org and project. Magic link sent. |
| CLI-02 | Client first setup | P0 | CL | Magic link opens password setup. After setup, user logs in with email and password (decision 21). |
| CLI-03 | Client project list | P0 | CL | Shows projects linked to the client's org. |
| CLI-04 | Issued drawings | P0 | CL | Lists issued sheets with revision, purpose and date. Internal states are never shown. |
| CLI-05 | Drawing view and download | P0 | CL | View per VIEW rules. Download per FIL-06. |
| CLI-06 | Transmittal history | P0 | CL | Per TRN-04. |
| CLI-07 | Conflict list | P0 | CL | Own conflicts with status and due date. |
| CLI-08 | No internal data | P0 | CL | Client cannot see approvals, internal comments, workload, other clients' data, or WhatsApp settings. Tested by attempting each route. |
| CLI-09 | Account created by admin only | P0 | AD | No self-registration (AUTH-06). |

### 3.21 Conflicts (CFL)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| CFL-01 | Raise conflict | P0 | CL | Form: subject (required, max 200 characters), content (required, plain text, max 10,000 characters), attachments (optional, same limits as FIL-01). Linked to a sheet or transmittal the client can see. |
| CFL-02 | Conflict thread | P0 | CL, AD, PH, DR (sheet's drafter) | Back-and-forth messages in time order. Each message shows author and time. |
| CFL-03 | Response window | P0 | System | Due date = 3 working days from raising (SET-01, per project). When a firm reply is made, due date is cleared. Overdue if no reply by due date. |
| CFL-04 | Overdue on dashboard | P0 | AD | Overdue conflicts shown on DSH-01, and in the morning digest (DIG). |
| CFL-05 | Status | P0 | System | Open, responded, awaiting client, closed. Client sees the same status words. |
| CFL-06 | Close conflict | P0 | AD, PH | Closing requires a final reply. Closed conflicts stay visible to the client. |
| CFL-07 | WhatsApp notice | P0 | System | Notice to project head and owner contains: project code, "New conflict", client user name, and the link. It contains no subject and no content (decision 10). |
| CFL-08 | Attachments | P0 | | Same validation as FIL-01 and FIL-03 (no naming check for client files). |

### 3.22 Notifications (NTF)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| NTF-01 | Bell | P0 | All | Unread count in the header. Opens a list of recent notifications, newest first. |
| NTF-02 | Mark as read | P0 | All | Clicking a notification marks it as read and opens its link. |
| NTF-03 | Notification content | P0 | | Title, one line of body, link to the item. |
| NTF-04 | Email fallback | P0 | AD | Used only for system health alerts and magic links. Not for routine notifications. |

### 3.23 WhatsApp (WA)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| WA-01 | Recipients | P0 | AD | Add owner and up to 4 internal people (total 5). Each has a phone number in international format and an active flag. |
| WA-02 | Event selection and "decision" | P0 | AD | Admin selects event types from a list with on or off per event (decision 11). Immediate alerts for every upload and every decision. **"Decision" is defined as:** an approval approved or rejected, a conflict response, a transmittal sent, and a revision issued (**to confirm, Q-P2**). |
| WA-03 | Opt-in confirmation | P0 | AD | Recipient must confirm in writing (admin records the date and how it was confirmed). Messages are not sent until confirmed. |
| WA-04 | Daily cap | P0 | AD | 30 per recipient per day by default (SET-05). Messages above the cap are held and included in the next digest with the note "More items not sent. See dashboard." |
| WA-05 | Immediate send | P0 | System | Event selected in WA-02 → outbox → sent within 1 minute when the connection is healthy. |
| WA-06 | Outbox and retries | P0 | System | Each message has a unique dedupe key. Failed sends retry after 1, 5 and 30 minutes, then are marked failed and shown in the admin panel. |
| WA-07 | Duplicate suppression | P0 | System | Same dedupe key is sent once. Same event for the same recipient within 5 minutes is merged into one message (proposed, A-W1). |
| WA-08 | STOP and START | P0 | Recipient | Message "STOP" sets opted-out. "START" sets opted-in again only if the admin has confirmed the recipient. Both replies confirm the change. |
| WA-09 | Inbound commands | P0 | Allowlisted numbers | Commands in WA-10. Other numbers are ignored and logged. |
| WA-10 | Command list | P0 | Allowlisted | `today`, `overdue`, `critical`, `digest`, `help`. Unknown text returns the command list. Replies are built from database queries, with no AI. |
| WA-11 | Connection health | P0 | System | Worker reports state every minute. Disconnected for more than 5 minutes → admin alerted in-app and by email (NTF-04). |
| WA-12 | Re-link | P0 | AD | Admin can see the QR code when re-linking is needed, in the admin panel, through the worker. |
| WA-13 | Message log | P0 | AD | Every outgoing and incoming message with time, status, recipient and event. Body preview stored for audit. |
| WA-14 | No quiet hours | P0 | | Messages send at any hour (decision). |
| WA-15 | No client recipients | P0 | | Client users cannot be added as WhatsApp recipients. The system rejects it. |
| WA-16 | No files on WhatsApp | P0 | | Messages never include drawing files. Links only. |

### 3.24 Digest (DIG)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| DIG-01 | Scheduled digest | P0 | AD | Sent at 09:00 IST (SET-06) to each recipient. Missed digest (worker down) is sent on restart with the note "Sent late." |
| DIG-02 | On-demand digest | P0 | Recipient | `digest` command (WA-10) sends the digest now. Rate limit: once per 10 minutes per number. |
| DIG-03 | Sections | P0 | | 1. Since last digest (uploads, decisions, issued revisions). 2. Waiting on you (approvals). 3. Overdue (sheets, reviews, RFIs, submittals, conflicts). 4. Due today. 5. Open critical items. 6. Overdue client conflicts (owner only). 7. Gemini paragraphs (DIG-04). 8. Your items (DIG-06). 9. Dashboard link. |
| DIG-04 | Gemini paragraphs | P0 | | Two optional paragraphs: (a) explanation of why each overdue item is overdue, (b) list of items changed in the last 24 hours. Input rows only. Validated per DIG-05. Labelled "Summary generated by Gemini". |
| DIG-05 | AI validation and fallback | P0 | System | Every sheet number, count and date in AI output must match an input row. If any fails, the deterministic text is sent, and the reason is stored in the digest record. |
| DIG-06 | Personal section | P0 | Recipient | Items assigned to that recipient. Same digest otherwise (decision 6). |
| DIG-07 | Digest history | P0 | AD | Each digest stored with its sent text and validation outcome. |
| DIG-08 | Digest length | P0 | | Under 1,500 characters. If longer, the lowest-priority sections are trimmed and "See dashboard for the rest" is added. |

### 3.25 Escalations and overdue checks (ESC)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| ESC-01 | Approval escalation | P0 | System | APR-05. Runs hourly. |
| ESC-02 | Conflict overdue | P0 | System | CFL-03. Runs hourly. |
| ESC-03 | RFI overdue | P0 | System | RFI-04. Runs daily at 09:00 IST, before digest. |
| ESC-04 | Submittal overdue | P1 | System | SUB-03. Runs daily. |
| ESC-05 | Checklist overdue | P1 | System | AUT-04. Runs daily. |
| ESC-06 | Stale-revision check | P0 | System | FIL-05. Runs on each file event and nightly. |

### 3.26 Critical rules (RUL)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| RUL-01 | Rule editor | P0 | AD | Visual editor for each kind: critical clash, critical RFI, critical revision, alert event. Plain-language preview of each rule ("A clash is critical when its discipline pair includes STR"). |
| RUL-02 | Project-specific rules | P0 | AD | Rules can apply to a project, or to all projects. |
| RUL-03 | Rule validation | P0 | | Cannot save a rule with no conditions, or with conditions that refer to unknown fields. |
| RUL-04 | Rule versions | P0 | AD | Each save creates a version with the time and the admin. |
| RUL-05 | Rule history view | P0 | AD | Lists versions, with what changed. Visible to admin (Q-P4 may extend it). |
| RUL-06 | Apply to new events only | P0 | System | Events record the rule version they were checked against. Changing a rule does not re-evaluate past events (decision 19). |

**Draft critical rules (from SCOPE.md, for the owner to edit):**
- **Critical clash:** involves structure, or a life-safety system (fire, medical gas, OT pressurisation), or blocks a sheet from issue.
- **Critical RFI:** stops work on site, or response due within 2 working days, or more than 7 days past deadline.
- **Critical revision:** an issued revision (R1 or later) that supersedes a sheet already issued to the client or contractor.

### 3.27 Export, delete and reopen (EXP)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| EXP-01 | Request export | P0 | AD | Only admin. Starts a background job. Status shown: queued, building, ready, failed. |
| EXP-02 | Export contents | P0 | | Drawings (originals), register, issue log, client conflict threads and attachments, transmittals, approvals, audit trail, rule history. |
| EXP-03 | Encryption | P0 | | Archive encrypted with a key the admin holds. Key is not stored in the system (O-T3). |
| EXP-04 | Download | P0 | AD | Signed URL, expires in minutes. Download logged. |
| EXP-05 | Delete project | P0 | AD | Requires: export status ready, a confirmation dialog, and typing the project code. Removes live data and files. Keeps the export and the audit record of the deletion. |
| EXP-06 | Reopen as read-only | P0 | AD | Upload the export archive and the key. Creates a read-only project copy. No edits, no WhatsApp, no client access unless admin enables it. |
| EXP-07 | Retention respected | P0 | | Export includes everything that client contracts and NDAs require (decision 34). The NDA file is included. |
| EXP-08 | Deletion blocked during an open conflict | P0 | | A project with open client conflicts cannot be deleted until they are closed. |

### 3.28 Client NDA (NDA)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| NDA-01 | NDA flag | P0 | AD | Checkbox per client org: NDA required. |
| NDA-02 | NDA upload | P0 | AD | If the flag is ticked, an NDA file must be uploaded before the client's first login. Cannot be skipped. |
| NDA-03 | NDA processing setting | P0 | AD | Option: allow Autodesk processing for this client (default on, to confirm O3). |
| NDA-04 | NDA file access | P0 | AD | Only admin and the client org's users can open the NDA file. |

### 3.29 Audit (AUD)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| AUD-01 | Audit log | P0 | AD | Filter by date, user, action, project. Shows before and after values where relevant. |
| AUD-02 | Audit log is read-only | P0 | | No edit or delete option anywhere. |
| AUD-03 | Same-person flag | P0 | AD | Approvals where requester and approver are the same person show a flag (APR-06). |
| AUD-04 | Coverage | P0 | | Every action listed in ARCHITECTURE.md, section 3, writes an audit entry. Tested per action. |

### 3.30 Reports (REP)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| REP-01 | Register report (PDF) | P1 | AD, PH | Filtered register with project header and date. |
| REP-02 | Issue log report (Excel) | P1 | AD, PH | Clashes, RFIs, submittals with status and age. |
| REP-03 | Dashboard snapshot (PDF) | P1 | AD | Current dashboard tiles with date and time in IST. |
| REP-04 | Transmittal list (Excel) | P1 | AD, PH | All transmittals with number, date, recipient and revision count. |

### 3.31 System health (SYS)

| ID | Feature | Pri | Roles | Acceptance criteria |
|---|---|---|---|---|
| SYS-01 | Health page | P0 | AD | Shows: database status, worker status, WhatsApp connection, outbox queue length, last digest time, last successful send, failed sends. |
| SYS-02 | Failed sends list | P0 | AD | Failed messages with reason and a retry button. |
| SYS-03 | Job status | P0 | AD | Last run and result for escalations, overdue checks, digest, exports. |

---

## 4. Lifecycle guards (LIFE detail)

| Transition | Who | Guards |
|---|---|---|
| not_started → assigned | DL, PH, AD | Owner set |
| assigned → wip | DR (owner), DL, PH | None |
| wip → internal_check | DR (owner) | Checker set for discipline |
| internal_check → approved | CK | Checker sign-off recorded |
| internal_check → wip | CK | Reason required |
| approved → coordination | DL, PH | Clash check started |
| coordination → approved | DL, PH | No open critical clashes |
| approved → issued / ifc / gfc | PH, CK (with PH) | LIFE-05 guards |
| issued → client_review | PH | Transmittal sent |
| client_review → commented | System | Conflict or review comment received |
| commented → revised | DR | New revision created |
| any live state → change | Any internal | APR-01 approval, then the change |
| issued → superseded | System | New revision issued |

**Note:** the diagram in ARCHITECTURE.md, section 3.3, gives the ordering. This table gives the guards.

---

## 5. Non-goals (explicitly not in the pilot)

- Integration with ACC, BIM 360, ProjectWise or SharePoint.
- Reusable library of standard details.
- Clash resolution in CAD. Geometry checks.
- Compliance checks (NBC, NABH, fire, AERB).
- AI beyond the digest paragraphs (title-block extraction, classification, routing, Q&A).
- Contractor or consultant logins.
- Multi-language. Dark mode. White-label.
- Billing. Site progress tracking. Native mobile apps.
- Public website.

---

## 6. Open feature questions

| ID | Question | Affects |
|---|---|---|
| Q-P1 | Confirm "all modules" = P0 and P1 plus the client portal | Scope size |
| Q-P2 | Confirm the definition of "decision" in WA-02 | Alert volume |
| Q-P4 | Who can see the rule history (RUL-05) | Access control |
| Q-P6 | Email to clients when a conflict is answered | Notifications |
| Q-P7 | Dashboard charts (DSH-05): yes or no | Build effort |
| Q-P9 | Should the system email transmittals to clients, or only record them as sent (TRN-03)? | Email, TRN |
| Q-P10 | Are project heads part of the WhatsApp group (for conflict notices, CFL-07)? | WA-01 |
| Q-P11 | Confirm the working-day rule: Monday to Friday with holidays, or another pattern (O-A1) | SLA dates |
| Q-P12 | Confirm the "due date" for RFIs and submittals can be set manually, with the default as a suggestion | RFI-01, SUB-01 |

---

## Appendix A — WhatsApp message templates

Templates are versioned. Each has a code, the variables it needs, and the text. Variables come only from the database. Each message is under 300 characters where possible and ends with one link.

| Code | Trigger | Text |
|---|---|---|
| WA-T01 Upload | File uploaded (WA-02) | `Upload: {file_name} by {user}, {time} IST. {link}` |
| WA-T02 Issued | Revision issued | `Issued: {sheet} {rev} ({title}), {project}, by {user}, {time} IST. Superseded: {prev_rev}. {link}` |
| WA-T03 Approval request | Approval requested | `Approval needed: {sheet} {rev} {transition}, assigned to {assignee}, due {due}. {link}` |
| WA-T04 Approval decision | Approved or rejected | `{decision}: {sheet} {rev} by {user}. {reason_if_any} {link}` |
| WA-T05 Escalation | Approval pending 2 working days | `Overdue approval: {sheet} {rev}, pending {days} working days with {assignee}. {link}` |
| WA-T06 Conflict notice | Conflict raised (CFL-07) | `New conflict on {project} from {client_user}, {time} IST. Open: {link}` |
| WA-T07 Conflict overdue | Conflict past reply window | `Conflict overdue: {project}, raised {date} by {client_user}. {link}` |
| WA-T08 RFI overdue | RFI past due | `RFI {number} overdue ({days} working days). {project}. {link}` |
| WA-T09 Critical clash | Critical clash opened | `Critical clash {number} on {project}: {title}. Disciplines {disc_a} and {disc_b}. {link}` |
| WA-T10 Stale revision | Stale-revision flag (FIL-05) | `Stale revision flag: {sheet} {rev} file changed without a new revision. {link}` |
| WA-T11 Connection | Worker disconnected > 5 min | `WhatsApp connection lost since {time} IST. Re-link: {link}` (sent in-app and by email) |
| WA-T12 Digest | 09:00 IST or on demand | See Appendix B |
| WA-T13 Cap reached | Daily cap hit | `More items not sent today. See dashboard: {link}` |
| WA-T14 Opt-out confirm | STOP received | `You will no longer receive updates. Send START to resume.` |
| WA-T15 Opt-in confirm | START received | `Updates resumed.` |
| WA-T16 Help | `help` or unknown text | `Commands: today, overdue, critical, digest, STOP, START` |

## Appendix B — Digest layout

```
Morning digest, {date}, 9:00 AM IST
Since yesterday: {uploads} uploads, {issued} issued revisions, {decisions} decisions.
  - {project}: {sheet} {rev} issued
  ...
Waiting on you: {n} approvals.
Overdue: {sheets} sheets, {rfis} RFIs, {reviews} reviews, {submittals} submittals.
Due today: {n} items.
Open critical: {n} clashes, {m} RFIs.
Client conflicts overdue: {n}.                  (owner only)
Summary generated by Gemini:
  {DIG-04 paragraph (a)}
  {DIG-04 paragraph (b)}
Your items: {list}
Dashboard: {link}
```

Rules: under 1,500 characters (DIG-08). Missing sections are omitted, not shown as zero. Gemini paragraphs are omitted when the validation fails (DIG-05).

## Appendix C — Decision traceability

| Decision | Features |
|---|---|
| 1 Upload and decision alerts immediate | FIL-08, WA-02, WA-05 |
| 2 Pilot recipients: owner plus 3–4 internal | WA-01, WA-15 |
| 3 Channel: test number now, Cloud API later | WA-12, ARCHITECTURE 6.3 |
| 4 Digest 09:00 IST, no recap | DIG-01, SET-06 |
| 5 Critical rules owner-defined | RUL-01 to RUL-06 |
| 6a Register from software | REG-01 to REG-04, IMP-01 to IMP-06 |
| 6b Naming standard | FIL-03, SET-03 |
| 6c SLAs with defaults and edit | SET-01, SET-02 |
| 6d Who can issue, approval shown in-app | LIFE-04 to LIFE-06, APR-01 to APR-09 |
| 6f Client read-only, raise conflict | CLI-01 to CLI-09, CFL-01 to CFL-08 |
| 6g Supabase | SCHEMA.md, ARCHITECTURE 9 |
| 7 Digest with Gemini specifics | DIG-04, DIG-05 |
| 8 Digest any time (admin schedule and on demand) | DIG-01, DIG-02, SET-06 |
| 9 Conflict notice to project head | CFL-07 |
| 10 Notice and link only | CFL-07, WA-16 |
| 11 Admin selects events | WA-02 |
| 12 Cap 30, admin set | WA-04, SET-05 |
| 13 Default approver project head | APR-01 |
| 14 Escalation to owner after 2 working days | APR-05, SET-01 |
| 15 Rejection with text, back to WIP | APR-04, LIFE-07 |
| 16 Bell and notification | NTF-01 to NTF-03, APR-08 |
| 17 Admin only access restriction | AUTH-01, AD column in section 2 |
| 18 SLAs per project | SET-02 |
| 19 Rule changes new events only, history kept | RUL-04 to RUL-06 |
| 20 Client sees transmittals and conflict status | CLI-06, CLI-07 |
| 21 Magic link then password | AUTH-01 to AUTH-03, CLI-02 |
| 22 Conflict form: subject, content, attachments | CFL-01, CFL-08 |
| 23 Back-and-forth thread | CFL-02 |
| 24 Client sees firm response | CFL-02, CFL-05 |
| 25 Client downloads | CLI-05, FIL-06 |
| 26 Conflict reply in 3 working days, overdue on dashboard | CFL-03, CFL-04, SET-01 |
| 27 All viewable formats | VIEW-01, VIEW-02 |
| 28 Autodesk viewing | VIEW-02, VIEW-03 |
| 29 Viewable for all with access | VIEW-01, VIEW-02 |
| 30 Supabase storage | FIL-01, SCHEMA.md 7 |
| 31 Hostinger Docker worker | ARCHITECTURE 2, TECH-STACK 5 |
| 34 Export and delete (admin, contents, retention) | EXP-01 to EXP-08 |
| 35 NDA checkbox and upload | NDA-01 to NDA-04 |
| 36 Drafters upload | FIL-01, Roles |
| 37 Naming standard decided by us | FIL-03, SET-03 |
| 38 Transmittal per project with date | TRN-02, SET-04 |
| 39 IFC and GFC: checker and project head | LIFE-04, LIFE-05, REV-02 |
| 40 Roles | Section 2 |
| 41 Combined roles, responsibility recorded | APR-06, AUD-03 |
| 42 Accounts by admin only | AUTH-01, CLI-09 |
| 43 English only | Scope, DESIGN.md |
| 44 IST | ARCHITECTURE 4, SET-06 |
| A1 Pilot 6 weeks, admin changes it | BUILD-PHASES.md (pilot phase) |
| A2 Any number of projects | PRJ-01 |
| A3 All modules | Section 1 (P0 and P1), Section 4 of PRD.md |
| A4 Register from Excel template | IMP-01 to IMP-06 |
| A5 Three measures | DSH-06, PRD 3.2 |
