# Architecture — Drawing Control & Alerts

**Status:** Draft for approval
**Scope:** MVP pilot (6 weeks, all modules, owner-led), with the client portal and the WhatsApp channel described in the decision log.
**Decision source:** `SCOPE.md` (v1) plus the decisions recorded in discussion. Items marked **OPEN** need your confirmation before build.

---

## 1. Context

The system is the single source of truth for drawing status, revisions, approvals, clashes, RFIs, transmittals and client conflicts across all hospital projects at the firm. It:

- stores the register and all state changes;
- enforces the drawing lifecycle and approval rules;
- shows sheets in the browser (PDF, DWG, RVT, IFC, NWD);
- sends WhatsApp alerts and a daily digest to the owner and a small internal group;
- gives clients read-only access to issued drawings, with conflict raising.

It does not design, check compliance, or edit CAD files.

```
                       ┌──────────────────────────┐
  Internal users ─────►│  Web app (Netlify)       │◄───── Client users
  (browser, phone)     │  Angular, PrimeNG        │       (browser, magic link)
                       └────────────┬─────────────┘
                                    │ HTTPS (Supabase JS, Netlify Functions)
                       ┌────────────▼─────────────┐
                       │  API layer (Netlify      │
                       │  Functions, TypeScript)  │
                       └──┬─────────┬─────────┬───┘
                          │         │         │
              ┌───────────▼──┐  ┌───▼─────┐  ┌▼────────────────────┐
              │ Supabase     │  │ Worker  │  │ Autodesk Platform   │
              │ Postgres     │  │ (Hostinger  │ Services (APS)      │
              │ Auth         │  │  VPS,   │  │ Model Derivative,   │
              │ Storage      │  │ Docker) │  │ Viewer SDK          │
              │ (India)      │  └──┬──┬───┘  └─────────────────────┘
              └──────────────┘     │  │
                                   │  │  ┌────────────────────┐
                    WhatsApp       │  └─►│ Gemini API         │
                    (whatsapp-web.js    │ (summaries only)   │
                    pilot; Cloud API    └────────────────────┘
                    later)     ◄────┘
```

---

## 2. Components

| # | Component | Runs on | Responsibility |
|---|---|---|---|
| C1 | Web app | Netlify (static build) | UI for internal users and client portal |
| C2 | API layer | Netlify Functions (Node 22, TypeScript) | Request handling, validation, orchestration, signed URLs, APS token exchange |
| C3 | Database, auth, storage | Supabase (India region) | Postgres with Row Level Security, email magic link and password auth, file storage |
| C4 | Worker | Hostinger VPS, Docker (2 vCPU, 8 GB RAM, 100 GB NVMe) | WhatsApp connection, outbox sender, inbound commands, scheduler (digest, escalation, overdue checks), digest generation, exports, APS translation jobs |
| C5 | Rules and events | Inside Postgres (tables) plus C2 and C4 code | Event log, rule evaluation, notification creation |
| C6 | Viewer | Browser | PDF.js for PDFs; Autodesk Viewer SDK for DWG, RVT, IFC, NWD |
| C7 | Gemini client | C4 only | Writes the digest's explanation text from structured rows, with validation |

**Why the worker is separate:** `whatsapp-web.js` needs a long-running process with a headless browser that keeps the session alive. Netlify Functions are short-lived and can't host it. Exports and APS translation also run longer than request limits allow, so they run on the worker too.

---

## 3. Key flows

### 3.1 Drawing upload

1. Drafter selects a file in the sheet's Files tab (web app).
2. C2 validates the sheet, the drafter's role on the project, and the file's extension and size.
3. C2 creates a row in `files` (state `uploading`) and returns a **resumable upload URL** for Supabase Storage (TUS protocol). The browser uploads directly to Storage. Large DWG and RVT files never pass through a Netlify Function.
4. On completion the browser calls C2 to confirm. C2 verifies the stored size and computes SHA-256 in C4 (from storage).
5. C2 writes an event `file.uploaded` and sets the file state `stored`.
6. C5 evaluates rules. Upload alerts are immediate (decision 1), subject to the daily cap (section 6).
7. If the format is DWG, RVT, IFC or NWD, C4 starts an APS translation job (section 3.6).

### 3.2 Register import

1. Admin or project head uploads the Excel register (template from decision A4).
2. C2 stores the file, creates `register_imports` (state `validating`) and returns a preview.
3. C4 parses the file, validates each row (duplicate sheet numbers, unknown discipline or status, unregistered owner email, invalid date) and writes the result to `register_imports.errors`.
4. The user confirms the preview. C2 writes the valid rows as sheets in one transaction and records each as an event.
5. Invalid rows are not written. The user can fix the file and re-import the failed rows only.

### 3.3 Lifecycle transition and approval

1. A user requests a transition (for example, `internal_check → approved`).
2. C2 checks the transition against the state machine and the guards (FEATURES.md, LIFE section).
3. For changes to a live sheet (state `issued`, `gfc` or `ifc`), C2 creates an `approvals` row assigned to the project head (default). For routine items, the assignee is the checker.
4. The transition, the approval and the event are written in one transaction.
5. C5 creates in-app notifications and a WhatsApp outbox entry if the event is selected by the admin.
6. Approve or reject: rejection requires a text reason and returns the sheet to `wip`.
7. A daily job (C4) escalates approvals pending for **2 working days** (admin-configurable) to the owner.

### 3.4 Issue (IFC, GFC or issued)

Issue is a single transaction in C2:

- checker sign-off recorded;
- zero open critical clashes on the sheet (rule evaluation);
- revision code is the next in sequence;
- transmittal created with its number (section 6.2);
- the previous issued revision is marked `superseded`;
- the new revision becomes current;
- event `revision.issued` recorded.

If any guard fails, the transaction rolls back and the API returns the failing rule in plain text.

### 3.5 Client conflict

1. Client opens a sheet or transmittal in the portal and selects **Raise a conflict**.
2. C2 checks the client account is linked to the project, and the sheet is issued to them.
3. The conflict and first message are stored. Attachments go to Storage through the same upload flow as 3.1, with a conflict link.
4. C5 creates notifications for the project head and owner. The WhatsApp message contains only the notice and link (decision 10).
5. Responses are stored in `conflict_messages`. The client sees all responses.
6. A daily job (C4) marks conflicts with no response after **3 working days** (per project, admin-configurable) as overdue and shows them on the owner's dashboard.

### 3.6 Viewing DWG, RVT, IFC and NWD (Autodesk)

1. On upload, C4 copies the original to an APS Object Storage bucket (a second copy, see section 9.4).
2. C4 submits a Model Derivative translation job for the object.
3. When translation completes, C4 stores the derivative URN in `files.aps_urn`.
4. The browser requests a viewing token from C2. C2 gets a short-lived token from APS using a server-side secret and returns only a read-scoped token.
5. The Viewer SDK loads the model using the URN and token.
6. PDF sheets skip APS and use PDF.js with a signed Supabase URL.

### 3.7 WhatsApp outbound (outbox)

1. C5 writes a row to `whatsapp_outbox` with a unique `dedupe_key` (for example `revision.issued:{revision_id}:{recipient_id}`).
2. C4 polls the outbox every 10 seconds, picks rows whose `next_attempt_at` is due, and sends them through whatsapp-web.js.
3. Before sending, C4 checks: recipient opted in, event selected by admin, daily cap not reached, connection healthy.
4. On success, the row is marked `sent` with the WhatsApp message ID. On failure, `attempts` increments and `next_attempt_at` backs off (1 min, 5 min, 30 min), then the row is marked `failed` and the owner is notified in-app.
5. Quiet hours do not apply (decision). The daily cap does.

### 3.8 WhatsApp inbound commands

1. C4 receives a message. If the sender number is not on the allowlist, it is ignored and logged.
2. C4 matches the text to a fixed command (`today`, `overdue`, `critical`, `digest`, `help`, `STOP`, `START`). Anything else returns `help`.
3. C4 runs a fixed query against Postgres (no AI) and sends the reply through the outbox.

### 3.9 Digest (9:00 AM IST, on demand and admin-scheduled)

1. The scheduler (C4) runs at the admin-set time in `Asia/Kolkata`.
2. C4 builds a **structured digest** per recipient from `events`, `approvals`, `sheets`, `clashes`, `rfis` and `conflicts`.
3. C4 renders the deterministic text from a template.
4. C7 (Gemini) receives only the structured rows and returns the two optional sections: the explanation of why an item is overdue, and the list of changes in the last 24 hours. Gemini has no tools and no web search.
5. C4 validates the Gemini text: every sheet number, count and date in the output must match a row in the input. If validation fails, the deterministic text is sent instead.
6. The digest is written to `digests`, then queued in the outbox. A copy is kept for the audit trail.

### 3.10 Export and delete (admin only)

1. Admin requests an export for a project. C2 creates `exports` (state `queued`).
2. C4 builds the export: originals from Storage, the register, the issue log, client conflict threads and attachments, transmittals, approvals, audit trail. Output is an archive encrypted with a key the admin holds.
3. The archive is stored in a private Supabase Storage bucket. The admin downloads it through a signed URL that expires in minutes.
4. The project's data can be deleted only after export is confirmed and the admin types the project code.
5. Deletion removes the live rows and files, keeps the export, and writes an audit entry. The audit entry itself is not deleted.
6. Reopening an export in the app creates a **read-only** project copy.

---

## 4. Data and time

- **Storage:** all timestamps are `timestamptz` in UTC.
- **Display:** IST (`Asia/Kolkata`) everywhere, with the offset where ambiguous.
- **Working days:** calculated from a `holidays` table (Karnataka public holidays and the firm's own closures). Weekends are not working days unless the firm says otherwise. **OPEN (O-A1):** confirm the weekend pattern and the holiday list.
- **Dates in the register:** `YYYY-MM-DD`, interpreted as IST dates.

---

## 5. Security

### 5.1 Identity

- Supabase Auth. Accounts are created by the admin only (decision 42).
- Client accounts: magic link sent by email for first setup, then password login (decision 21). Password reset uses a magic link.
- **MFA:** not in the pilot. **OPEN (A-S1).**
- Sessions: JWT access tokens with refresh. Session length: **OPEN (O-A2).**

### 5.2 Authorisation

- Row Level Security enabled on every table.
- Roles are stored in `user_roles(user_id, role, project_id)`. A user can hold several roles on one project (decision 41); permissions are the union.
- Firm-wide roles (admin) have `project_id = null`.
- Clients see only issued revisions of their linked projects, plus their own conflicts and transmittals.
- The worker and the API use the **service role** key to act across projects. Because service role bypasses RLS, every worker query is written to check the target project and recipient explicitly. This is a code rule and is tested.
- Same-person approval: a person who holds several roles may perform a step and also approve it (decision 41). The responsibility is recorded against that person. The audit trail flags the approval as "same person" (APR-06, AUD-03). The system does not block it.

### 5.3 Data protection

- HTTPS everywhere. Supabase and Netlify enforce TLS.
- Encryption at rest: Supabase default. Export archives encrypted with a separate key.
- Signed URLs for files, short-lived (minutes). No public buckets.
- Autodesk secrets and Gemini key are server-side only: Netlify environment variables and the worker's environment file. Never in the browser bundle.
- WhatsApp session data stored on the worker's encrypted volume, outside the repository.
- Audit log is append-only. Triggers block update and delete on `audit_log`.

### 5.4 Abuse controls

- Inbound WhatsApp: allowlist only, command rate limit per number (for example 10 per 10 minutes).
- Worker endpoints called by C2 use HMAC-signed requests with a timestamp window (reject > 5 min old).
- Client portal: login rate limits from Supabase Auth; conflict creation limited per client per day (proposed: 20).

### 5.5 Secrets management

| Secret | Location | Used by |
|---|---|---|
| Supabase service role key | Netlify env, worker env | C2, C4 |
| Supabase anon key | Web app build (public by design) | Browser |
| Gemini API key | Worker env only | C7 |
| APS client ID and secret | Netlify env (token exchange), worker env (translation) | C2, C4 |
| WhatsApp session data | Worker encrypted volume | C4 |
| Export encryption key | Admin holds it; not stored in the system | C4 |
| HMAC secret (C2 ↔ C4) | Netlify env, worker env | C2, C4 |

Rotation: documented procedure, quarterly, and immediately on any suspected exposure.

---

## 6. WhatsApp channel design

### 6.1 Recipients

- Owner plus 3–4 internal people, managed in the admin panel.
- Each recipient must confirm in writing that they accept messages (checked by admin, recorded).
- Clients are never recipients.

### 6.2 Limits

- **Daily cap:** 30 messages per recipient per day (admin-configurable). Messages above the cap are held and included in the next digest with a note.
- **Pacing:** no more than about 3 messages per recipient per minute from the worker. Above this, the outbox queues.
- **No quiet hours** (decision).

### 6.3 Transport

| Phase | Transport | Notes |
|---|---|---|
| Pilot | whatsapp-web.js on a dedicated test number | Owner accepted ban risk in writing (decision 3). Not for client data. |
| Production | Meta WhatsApp Cloud API | Templates must be pre-approved. Business-initiated messages need approved templates. |

The outbox and command logic are transport-agnostic. Switching transport changes only the sending adapter.

### 6.4 Health

- The worker reports connection state every minute.
- If disconnected for more than 5 minutes, the owner gets an in-app alert and an email (email provider **OPEN, O-A3**). WhatsApp cannot be used to report its own failure.
- A status page in the admin panel shows the last successful send, queue length and connection state.

---

## 7. Event model

All business changes produce an event in `events`:

```
event = { id, type, entity_type, entity_id, project_id, actor_id, payload, created_at }
```

Event types (examples): `file.uploaded`, `revision.issued`, `revision.superseded`, `sheet.status_changed`, `approval.requested`, `approval.approved`, `approval.rejected`, `approval.escalated`, `clash.opened`, `clash.resolved`, `rfi.created`, `rfi.overdue`, `conflict.raised`, `conflict.responded`, `conflict.overdue`, `transmittal.created`, `register.imported`, `export.completed`, `session.disconnected`.

Consumers:
- **Rules** (admin-defined) decide which events are immediate alerts. Rule changes apply to new events only; each rule has versions, and each event records the rule version it was evaluated against.
- **Notifications** for the in-app bell.
- **Digest** builder reads events and entity tables for the digest window.

---

## 8. Failure modes

| Failure | Behaviour | Recovery |
|---|---|---|
| Supabase unavailable | Web app shows a banner; writes blocked | Automatic when service returns; no data loss because writes are transactional |
| Netlify Function timeout | Request fails; client retries with idempotency key | Idempotency key stored per request |
| Worker down | Outbox fills; digest not sent | Owner alerted by email; queue drains on restart; missed digest sent on restart with a note |
| WhatsApp session disconnected | Outbox paused; owner alerted in-app and by email | Re-link by QR code on the worker; queue resumes |
| Gemini unavailable or invalid output | Digest sent with deterministic text | Logged; no user action |
| APS translation fails | File stays viewable as download-only; retry up to 3 times | Admin sees the failure on the file |
| Upload interrupted | Resumable upload continues from last chunk | Automatic |
| Duplicate event | `dedupe_key` prevents double outbox rows | Automatic |
| Rule misconfiguration | Admin rule editor validates before save | Rule versions allow rollback |

---

## 9. Data residency and third parties

### 9.1 Where data lives

| Data | Location | Residency |
|---|---|---|
| Database, auth, files (originals) | Supabase, India region | India (decision 33) — **OPEN (O-A4):** confirm the Mumbai region is available on the firm's plan |
| Worker, WhatsApp session, export builds | Hostinger VPS | **OPEN (O2):** confirm India location |
| Web app static files | Netlify CDN | Static, no client data stored |
| Function execution | Netlify Functions | Data passes through; **OPEN (O-A5):** confirm execution region |
| Converted drawings (derivatives) | Autodesk Platform Services | Outside India. **OPEN (O3):** confirm NDAs allow this |
| Summaries | Gemini API | Digest rows sent to Gemini. **OPEN (O-A6):** confirm the firm's data policy allows this |
| WhatsApp messages | WhatsApp (Meta) | Outside India; contains project identifiers, no drawing content |

### 9.2 Hospital NDAs

- Each client organisation has an `nda_required` flag and an optional NDA file (decision 35).
- If ticked, the NDA file must be uploaded before the client can log in.
- NDA terms can restrict where files are processed. If an NDA forbids APS processing, that client's files are view-only through PDF.

### 9.3 Export retention

Export archives keep the records that client contracts and NDAs require (decision 34). The archive is the retention copy after live deletion.

### 9.4 APS copy

Model Derivative needs the source file in APS Object Storage. This creates a second copy of DWG, RVT, IFC and NWD files. **OPEN (O-A7):** confirm the firm accepts this copy. Proposed rule: APS copies are deleted when the sheet revision is superseded and the derivative is no longer needed, but the Supabase original is kept per retention.

---

## 10. Observability

- Structured JSON logs from C2 and C4 (no personal data beyond user IDs and sheet numbers).
- Health endpoint on C2 and on C4 (database, queue depth, WhatsApp state, last digest time).
- Error tracking: Sentry optional (**OPEN, O-A8**).
- Audit log for user actions (section 5.3).
- Owner dashboard shows system health only to admin.

---

## 11. Deployment

| Environment | Web app | API | Database | Worker |
|---|---|---|---|---|
| Development | Netlify branch deploy | Netlify branch functions | Supabase dev project | Local Docker, test WhatsApp number |
| Staging | Netlify staging site | Netlify staging functions | Supabase staging project (India) | Hostinger staging container |
| Production | Netlify production site | Netlify production functions | Supabase production project (India) | Hostinger production container |

- Database changes: versioned SQL migrations, applied to staging first, then production, with a backup taken before each production migration.
- Worker: Docker image built in CI, tagged with the commit ID, rolled back by redeploying the previous tag.
- Secrets differ per environment. Production secrets are never used on development machines.

---

## 12. Backups and recovery

- Supabase: daily backups with point-in-time recovery if the firm's plan includes it. **OPEN (O-A9):** confirm plan and retention.
- Storage: versioning on, or a nightly copy to a second bucket (decision after plan confirmed).
- Worker: stateless except the WhatsApp session. The session volume is backed up daily, encrypted. Losing it means re-linking by QR code.
- Recovery target and time: to define with the owner before go-live (proposed: restore database within one working day).

---

## 13. Scale assumptions

The pilot is small: a few projects, a handful of internal users, and a few hundred sheets. The architecture doesn't need horizontal scaling for the pilot. Scale limits to check during the pilot:

- Supabase plan limits for storage size and concurrent connections.
- Netlify Function execution time and payload limits (uploads avoid them by design).
- Worker memory with Chromium (one WhatsApp session comfortably within 8 GB).

Measured numbers replace these assumptions after week 2 of the pilot.

---

## 14. Architecture decisions (ADR summary)

| ADR | Decision | Reason | Alternatives rejected |
|---|---|---|---|
| ADR-01 | Software is the register; spreadsheet import first | Decision 6a | Sync from design tools (later) |
| ADR-02 | Event log drives alerts and digest | One source for every notification; auditable | Direct calls from each feature |
| ADR-03 | WhatsApp sending through an outbox | Retries, dedupe, caps, auditability | Send inline in request handlers |
| ADR-04 | Worker runs WhatsApp, scheduler, exports, APS jobs | Long-running work and a persistent browser | All on Netlify (not possible for WhatsApp) |
| ADR-05 | Direct browser upload to Storage with resumable protocol | Large CAD files, Netlify payload limits | Upload through Netlify Functions |
| ADR-06 | Gemini gets structured rows only, no tools | Limits what the model can see and do | Gemini with web search and open data access |
| ADR-07 | Deterministic digest with validated AI text | Content stays correct even when AI fails | AI-generated digest without validation |
| ADR-08 | Autodesk for DWG, RVT, IFC, NWD; PDF.js for PDF | Browser viewing of CAD and BIM without local software | Desktop software download (rejected by owner) |
| ADR-09 | Supabase for database, auth and files | Single platform, India region, RLS | Separate database and auth services |
| ADR-10 | Transport abstracted behind an adapter | Pilot on whatsapp-web.js, production on Cloud API | Hard-coding one transport |

---

## 15. Open architecture items

| ID | Item | Owner |
|---|---|---|
| O-A1 | Weekend pattern and holiday list for working-day calculations | Owner |
| O-A2 | Session length for internal and client users | Owner |
| O-A3 | Email provider for magic links and health alerts (Supabase default or custom SMTP) | You |
| O-A4 | Supabase India region available on the firm's plan | You |
| O-A5 | Netlify Function execution region | You (check Netlify docs) |
| O-A6 | Firm's data policy for sending digest rows to Gemini | Owner |
| O-A7 | Acceptance of APS copies of CAD files | Owner |
| O-A8 | Sentry for error tracking: yes or no | You |
| O-A9 | Supabase plan: backups, point-in-time recovery, storage limits | You |
| A-S1 | No MFA in the pilot | Owner |
