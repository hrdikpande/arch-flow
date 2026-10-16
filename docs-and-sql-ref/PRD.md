# Product Requirements Document — Drawing Control & Alerts

**Version:** 2.0 (supersedes SCOPE.md v1)
**Date:** 16 Oct 2026
**Status:** Draft for owner approval
**Companion documents:** FEATURES.md (feature inventory and acceptance criteria), SCHEMA.md, TECH-STACK.md, ARCHITECTURE.md, DESIGN.md, BUILD-PHASES.md, IMPLEMENTATION-PLAN.md, VERIFICATION.md

---

## 1. Problem

The firm designs and engineers hospitals (OTs, ICUs, radiology, medical gas, isolation wards, MEP). A single hospital project can have thousands of sheets, produced by 200+ architects across many concurrent projects.

Today, drawing status is tracked across spreadsheets, email, WhatsApp and the design tools. The owner doesn't have one view of:

- which sheets are late or stuck;
- which revision is current, and which revision has reached the client or the contractor;
- which clashes are critical and unresolved;
- which contractor queries (RFIs) and client conflicts are overdue;
- who is waiting on whom.

The consequences are costly: a contractor builds from an outdated revision, a clash is found late and reworked, review comments are lost in messages, and the owner spends hours each week compiling status.

## 2. Users

| User | What they need | Frequency |
|---|---|---|
| **Owner (admin)** | One view of all projects, alerts for critical events, control over rules and settings | Daily, morning digest; ad hoc |
| **Project head** | Approvals for changes to live sheets, conflict responses, team workload, project SLAs | Daily |
| **Discipline lead** | Assigning and reviewing work, coordinating clashes | Daily |
| **Drafter** | Uploading sheets, updating status, responding to conflicts with the project head | Daily |
| **Checker** | Internal check sign-off | Daily |
| **Client (hospital)** | Viewing and downloading issued drawings, raising conflicts, seeing transmittals and conflict status | Weekly to monthly |

Detailed roles and permissions: FEATURES.md, section 2.

## 3. Goals and success measures

### 3.1 Goals (pilot)

1. Give the owner a reliable daily picture of drawing status across all pilot projects.
2. Stop out-of-date revisions being used or sent.
3. Make approvals and conflicts visible, assigned and time-bound.
4. Replace manual status compilation with system-generated summaries.

### 3.2 Pilot success measures (decision A5)

| Measure | Definition | Baseline | Target |
|---|---|---|---|
| Stale-revision incidents | Number of cases where an outdated revision was used on site or sent to a client or contractor during the pilot | **To be measured by the owner before go-live** | **Owner to set** |
| Overdue RFIs | Count of RFIs past their response deadline, measured weekly | **To be measured before go-live** | **Owner to set** |
| Owner reporting time | Hours per week the owner spends compiling status | **Owner's estimate before go-live** | **Owner to set** |

**Measurement:** stale-revision incidents from the software's audit trail plus owner confirmation. Overdue RFIs from the dashboard. Reporting time from a weekly owner entry.

**Note:** targets are not invented here. A target without a baseline can't show a change, so both must be set before go-live.

### 3.3 Secondary measures (tracked, not targets)

- Number of alerts muted versus kept by the owner.
- Digest open rate (read receipts are not available on WhatsApp; use in-app digest views).
- Number of approvals escalated.
- Number of client conflicts raised and average response time.

## 4. Scope

### 4.1 In scope for the pilot

Decision A3 is "all modules". For this document, **all modules** means every P0 and P1 module from the module list, plus the client portal (decision 6f). The following are included:

| Area | Included |
|---|---|
| Projects and structure | Projects, disciplines, teams, roles, project SLAs |
| Register | Sheets, Excel import, manual entry, owner, due date |
| Lifecycle | State machine, transition guards, revisions, supersession |
| Files | Upload (resumable), naming standard, versions, viewing |
| Viewing | PDF (PDF.js); DWG, RVT, IFC, NWD (Autodesk) |
| Review | Review comments per revision |
| Approvals | Assignment, approve, reject with reason, escalation |
| Clashes | Issue log, critical flag, Navisworks import (format per O1) |
| RFIs | Log, responses, deadlines |
| Submittals | Log, approval status, deadlines |
| Change tracking | Changes requested after issue, reason, cost and time fields |
| Authority submissions | Checklists per authority, tick-off |
| Transmittals | Creation, numbering, distribution log, client history |
| Workload | Assigned sheets and hours per person against capacity |
| Dashboards | Owner dashboard, role-based home |
| Client portal | Magic-link onboarding, issued drawings, downloads, transmittal history, conflicts |
| Conflicts | Subject, content, attachments, back-and-forth thread, response window |
| Notifications | In-app bell, WhatsApp alerts, morning digest, on-demand digest |
| WhatsApp | Recipients, event selection, daily cap, inbound commands, opt-out |
| AI | Gemini text in the digest only |
| Admin | Users, roles, rules, SLAs, WhatsApp settings, naming and transmittal formats |
| Export | Admin export of a project, encrypted; delete after export; read-only reopen |
| Audit | Append-only audit trail; viewable by admin |
| Reports | PDF and Excel exports of register, issue log and dashboard (P1) |

### 4.2 Out of scope for the pilot

- Integration with ACC, BIM 360, ProjectWise or SharePoint (P2). The register import is the pilot's data path.
- Reusable library of standard details (P2).
- Clash resolution, CAD editing, geometry checks.
- Compliance checks against NBC, NABH, fire or AERB rules.
- AI features other than the digest text (title-block extraction, classification, RFI routing, Q&A).
- Contractor and consultant logins.
- Multi-language. Dark mode. White-label branding.
- Billing and invoicing.
- Site progress tracking.
- Mobile native apps (responsive web only).
- Public website.

### 4.3 Corrections from SCOPE.md v1

SCOPE.md v1 left out review comments, submittals, change tracking, authority submission checklists, workload and the PDF/Excel exports, all of which are within "all modules". v2 includes them. **Please confirm** that "all modules" means P0 and P1 plus the client portal (question Q-P1).

## 5. Functional requirements

Requirements are grouped by module. Each requirement has an ID that matches FEATURES.md, where the acceptance criteria are written.

### 5.1 Projects and structure
- **PRJ-01** Create and edit projects with code, name, client organisation, status and dates.
- **PRJ-02** Project code is unique and used in file names, transmittal numbers and imports.
- **PRJ-03** Set SLAs per project (defaults in 5.12).
- **PRJ-04** Assign people to projects with roles (combined roles allowed).

### 5.2 Register and lifecycle
- **REG-01** Register holds every sheet: number, title, discipline, project, owner, due date, current revision, state, history.
- **REG-02** Sheet numbers are unique within a project.
- **REG-03** Lifecycle states and transition guards as in ARCHITECTURE.md, section 3.3–3.4.
- **REG-04** Issued revisions are immutable. A change creates a new revision.
- **REG-05** Issuing supersedes the previous revision automatically.
- **REG-06** Every state change records actor, time and before/after values.

### 5.3 Files and viewing
- **FIL-01** Upload DWG, RVT, IFC, NWD, PDF with resumable upload for large files.
- **FIL-02** Suggest the naming standard (section 5.13) and warn on mismatch.
- **FIL-03** Store SHA-256 for each file; detect a file changed without a new revision.
- **FIL-04** View PDF in the browser; view DWG, RVT, IFC, NWD through Autodesk.
- **FIL-05** Download issued files for clients and internal users with permission.

### 5.4 Approvals
- **APR-01** Changes to a live sheet require project-head approval; routine items require checker sign-off.
- **APR-02** Approvals show who must act, the due date and the request context.
- **APR-03** Approvers see requests in the bell and on "My approvals".
- **APR-04** Rejection requires a text reason and returns the sheet to WIP.
- **APR-05** Pending approvals escalate to the owner after the admin-set number of working days (default 2).
- **APR-06** A person who performed a step may also approve it if they hold the role. The approval is recorded against them and flagged in the audit view (decision 41).

### 5.5 Clashes, RFIs, submittals, change tracking, authority items
- **CLS-01** Log clashes with disciplines, priority (critical, major, minor), linked sheets and status.
- **CLS-02** Import clash reports (format per O1).
- **RFI-01** Log RFIs linked to sheets, with response deadline and status.
- **SUB-01** Log submittals with approval status and deadline.
- **CHG-01** Record changes requested after issue, with reason, cost and time impact fields.
- **AUT-01** Authority checklists per project (for example building sanction, fire NOC, AERB), with items ticked by the responsible person.

### 5.6 Review comments
- **RVW-01** Comments attached to a revision, with reviewer, text, status (open, closed) and resolution note.

### 5.7 Transmittals
- **TRN-01** Create a transmittal from selected sheet revisions with recipient and date.
- **TRN-02** Number format per section 5.13.
- **TRN-03** Transmittal history visible to the owner, project heads and the client.

### 5.8 Dashboards and workload
- **DSH-01** Owner dashboard: overdue sheets, reviews, RFIs, submittals; stale-revision incidents; open issues by age (0–7, 8–14, 15+ days); overdue client conflicts; workload.
- **DSH-02** Role-based home for other roles (their own items first).
- **DSH-03** Workload per person against a capacity set by admin.

### 5.9 Client portal
- **CLI-01** Magic-link setup, then password login (decision 21).
- **CLI-02** Clients see issued revisions of their projects only, with download.
- **CLI-03** Clients see transmittal history and the status of their conflicts.
- **CLI-04** Client accounts are created by the admin only (decision 42).

### 5.10 Conflicts
- **CFL-01** Raise a conflict with subject (one line), content (text box) and attachments.
- **CFL-02** Conflict is a back-and-forth thread; the client sees all firm responses.
- **CFL-03** Response window: 3 working days (per project, admin-configurable). Overdue conflicts appear on the owner's dashboard.
- **CFL-04** WhatsApp notice to owner and project head contains no client text, only the link (decision 10).

### 5.11 Notifications and WhatsApp
- **NTF-01** In-app bell with unread count and a list.
- **WA-01** Recipients: owner and 3–4 internal people; each confirms opt-in in writing (recorded).
- **WA-02** Admin selects which events send on WhatsApp.
- **WA-03** Immediate sends for every upload and every decision (decision 1). **Definition of "decision"** is in FEATURES.md, WA-02 (**to confirm, Q-P2**).
- **WA-04** Daily cap, default 30 per recipient per day, admin-configurable.
- **WA-05** No quiet hours (decision).
- **WA-06** Inbound commands: today, overdue, critical, digest, help, STOP, START.
- **WA-07** Daily digest at 9:00 AM IST (admin-configurable) and on demand.

### 5.12 Admin and rules
- **ADM-01** Admin manages users, roles, WhatsApp recipients and event selection.
- **ADM-02** Admin defines critical rules (clash, RFI, revision) in the admin panel; project-specific allowed (decision 5, 18).
- **ADM-03** Rule changes apply to new events only; rule versions are stored and viewable (decision 19).
- **ADM-04** Admin sets SLAs per project: internal review 3 working days, client review 5, RFI response 7, submittal approval 10, conflict reply 3, approval escalation 2. All editable.
- **ADM-05** Admin sets naming and transmittal formats before the first transmittal is issued.

### 5.13 Naming, transmittal and numbering standards (proposed)
- **File name:** `{PROJECT CODE}_{DISCIPLINE}_{SHEET}_{REV}.{ext}` — example `NRH-BLR-01_HVAC_M-101_R02.dwg`.
- **Transmittal:** `{PROJECT CODE}-TR-{YYYYMM}-{NNN}` — example `NRH-BLR-01-TR-202611-001`, sequence resets monthly per project.
- **Discipline codes:** ARC, STR, CIV, HVAC, ELE, PLB, FIR, MGS, ELV, MEP, LND.
- **Status:** these are proposals. Owner approval required (decision 37, A-N1, A-T1).

### 5.14 Register import
- **IMP-01** Import from the downloadable template (`drawing_register_template.xlsx`) with Project Code, Sheet Number, Title, Discipline, Current Revision, Status, Owner Email, Due Date.
- **IMP-02** Preview with row-level errors before any save; partial import of valid rows only if the user chooses.
- **IMP-03** Imports are logged.

### 5.15 Export, delete and retention
- **EXP-01** Admin only.
- **EXP-02** Export contains drawings, register, issue log, client conflict threads and attachments, transmittals, approvals and audit trail.
- **EXP-03** Export is encrypted; the admin holds the key.
- **EXP-04** Delete requires a completed export and typing the project code.
- **EXP-05** Reopen as read-only copy.
- **EXP-06** Retention: client contracts and NDAs define what is kept; the export is the retention copy.

### 5.16 Audit
- **AUD-01** Every create, edit, transition, approval, rejection, upload, download, conflict message, WhatsApp send and export is recorded.
- **AUD-02** Audit log is read-only, including for admin.

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Accessibility | WCAG 2.2 AA (DESIGN.md, section 9) |
| Security | Row Level Security everywhere; signed URLs; secrets server-side; audit log append-only |
| Privacy | Client data visible only to that client's projects; no client text on WhatsApp |
| Data residency | India for database and files (decision 33); Autodesk and Gemini residency per O-A6 and O3 |
| Availability | Business hours target 99.5% (proposed; owner to confirm); WhatsApp is best-effort, with in-app fallback |
| Performance | Register table loads a page of 50 sheets in under 2 seconds on a typical office connection (proposed; to verify in pilot) |
| Upload | Resumable; files up to the Supabase plan limit (O-A9) |
| Time | Stored in UTC; displayed in IST |
| Language | English only |
| Browsers | Latest two versions of Chrome, Edge, Safari, Firefox; mobile Safari and Chrome |
| Backup | Daily; restore target within one working day (proposed) |
| Audit retention | As long as the project exists, plus the retention period in EXP-06 |

## 7. User journeys (summary)

1. **Owner, morning:** receives the 9:00 AM digest on WhatsApp, opens the dashboard link, sees one overdue approval and one overdue client conflict, opens the conflict, asks the project head for a response.
2. **Drafter, upload:** opens sheet M-101, uploads R2 (DWG), sees the naming warning, fixes the name, the file is stored, the translation starts, the owner receives an immediate WhatsApp alert for the upload.
3. **Project head, approval:** receives an in-app request to approve a change to issued M-101 R2; reviews the reason and the diff; approves; the sheet moves to GFC.
4. **Checker, issue:** checks the sheet, signs off, creates a transmittal, issues R2; the previous revision is superseded; the owner receives an alert.
5. **Client, conflict:** logs in through the portal, sees an issued sheet, raises a conflict with a subject and a message and an attachment; the project head receives a notice; the client sees the response.
6. **Admin, closing a project:** exports the project, checks the archive, deletes the live project after typing the code; reopens the archive later as read-only.

## 8. Release criteria (pilot go-live)

Go-live happens when all of these are true:

1. All P0 features in FEATURES.md pass their acceptance criteria in staging.
2. Register imported and checked by the project lead for each pilot project.
3. Users and roles created; client accounts created for pilot clients only.
4. WhatsApp group members confirmed opt-in in writing; owner signed the WhatsApp risk acceptance.
5. Dedicated test number and worker running on the Hostinger VPS; health check green for 48 hours.
6. Autodesk, Gemini and data-residency items (O2, O3, O-A6, O-A7) closed.
7. Baselines recorded for the three pilot measures.
8. Backup and restore tested once on staging.
9. Owner confirmed the digest and alert copy (DESIGN.md, 10.1; FEATURES.md, Appendix A and B).

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp restriction or ban on the test number | Medium | High (alerts stop) | Dedicated number; daily cap; pacing; in-app fallback; owner accepted risk in writing; Cloud API for production |
| Poor data quality in the imported register | High | High (false alerts, loss of trust) | Validation preview; project lead checks before go-live; error report |
| Low adoption by drafters and checkers | Medium | High | Upload is quick and sheet-first; training per role; owner uses the dashboard in weekly reviews |
| Autodesk cost higher than expected | Medium | Medium | Pricing confirmed before build (O5); PDF fallback; translation only for pilot projects |
| Client NDA forbids Autodesk processing | Medium | High | NDA flag; per-client viewing mode (PDF only) |
| Large files exceed upload or storage limits | Medium | Medium | Resumable upload; plan confirmed (O-A9); file-size warning |
| Gemini output contains incorrect numbers | Low | High | Validation against source rows; fallback to deterministic text |
| Scope creep from "all modules" | High | High | Feature inventory with IDs; changes need owner approval; P2 list fixed |
| Combined roles blur accountability | Medium | Medium | Responsibility recorded per action; same-person approvals flagged in the audit view (APR-06, AUD-03) |
| Supabase service role misuse in worker code | Low | High | Explicit project checks in every worker query; code review; tests |
| Owner's rules are unclear or too broad | High | Medium | Draft definitions provided; rule versions; review at week 3 |

## 10. Assumptions

- The owner accepts the pilot's WhatsApp risk in writing before the test starts.
- Project leads prepare the register export and check it.
- Drafters and checkers enter their own work in the software during the pilot.
- Hospital clients accept magic-link login and password.
- The firm's naming and transmittal formats can be adjusted to the proposals.

## 11. Dependencies

- Lead's answer on the clash export format (O1).
- Autodesk account and pricing (O5), NWD support (O4).
- Hostinger location confirmed (O2).
- Supabase plan and India region (O-A4, O-A9).
- Owner's answers to open questions (FEATURES.md, section 12).

## 12. Open product questions

| ID | Question | Why it matters |
|---|---|---|
| Q-P1 | "All modules" = P0 and P1 plus client portal? | Sets the MVP size |
| Q-P2 | Define "decision" for immediate alerts: approvals and rejections only, or also conflict responses and transmittal creation? | Alert volume |
| Q-P3 | Working-day calendar: weekend pattern and holidays (O-A1) | Every SLA depends on it |
| Q-P4 | Who may see the rule history (ADM-03): admin only, or project heads too? | Access control |
| Q-P5 | Session length and password rules (O-A2) | Security |
| Q-P6 | Do clients need notifications by email when a response arrives? | Client experience |
| Q-P7 | Dashboard charts: needed in the pilot, or tables and counts only? | Build effort |
| Q-P8 | Naming and transmittal formats approved (A-N1, A-T1)? | Data consistency |
