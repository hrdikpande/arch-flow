# Verification Log — Documents v2 against our decisions
> **Read section 10 first.** Sections 1 to 7 record the earlier checks and are kept as history. Where they describe the worker, Netlify, Hostinger, daily cron or a Cloud-only WhatsApp plan, section 10 gives the current position.


**Checked:** 16 Oct 2026
**Checked against:** the decisions recorded in our discussion (A1–A5, 1–44, 6a–6g, 7–12, 13–19, 20–44 as answered), SCOPE.md v1, and the three uploaded reference files.
**Result:** all decisions are represented. Four corrections were made against SCOPE.md v1. Several items in the uploaded reference do not apply and were removed. Open items are listed in section 5.

---

## 1. Decision traceability

Status key: ✔ included as decided · ⚠ included, interpretation to confirm · ✖ not included (reason given)

| # | Decision | Where | Status |
|---|---|---|---|
| A1 | Pilot 6 weeks, admin can change | BUILD-PHASES (Pilot), FEATURES SET | ✔ |
| A2 | Any number of projects | FEATURES PRJ-01 | ✔ |
| A3 | All modules = basic MVP | FEATURES section 1; PRD 4.1 | ⚠ Interpreted as P0 and P1 plus client portal. Q-P1 |
| A4 | Register via downloadable sheet, reupload | FEATURES IMP-01 to IMP-06; template file | ✔ |
| A5 | Three measures: stale revisions, overdue RFIs, owner reporting time | PRD 3.2; FEATURES DSH-06 | ✔ Baselines and targets left to owner |
| 1 | Immediate alerts for every upload and decision | FEATURES FIL-08, WA-02, WA-05 | ⚠ "Decision" defined in WA-02. Q-P2 |
| 2 | Recipients: owner plus 3–4 internal people | FEATURES WA-01, WA-15 | ✔ |
| 3 | Test number now, Cloud API later | ARCHITECTURE 6.3; TECH-STACK 5 | ✔ |
| 4 | Digest 09:00 IST, no recap | FEATURES DIG-01, SET-06 | ✔ |
| 5 | Owner defines critical rules, project-specific | FEATURES RUL-01 to RUL-06 | ✔ |
| 6a | Software is the register, spreadsheet import first | ARCHITECTURE ADR-01; FEATURES REG, IMP | ✔ |
| 6b | Firm's numbering standard, else proposed | SCHEMA settings; FEATURES SET-03 | ⚠ Proposal in use until firm's standard is known |
| 6c | SLA defaults, editable | FEATURES SET-01, SET-02 | ✔ |
| 6d | Checker for routine, project head for live sheets, shown in-app | FEATURES LIFE-04 to LIFE-06, APR | ✔ |
| 6e | Clash import per lead's format | FEATURES CLS-04 (P1); BUILD-PHASES 4 gate | ✔ Waiting for O1 |
| 6f | Client read-only, download, raise conflict | FEATURES CLI, CFL | ✔ |
| 6g | Supabase for data, storage, auth | SCHEMA, TECH-STACK 4 | ✔ |
| 7 | Digest deterministic plus Gemini specifics | FEATURES DIG-04, DIG-05 | ✔ |
| 8 | Digest any time: admin schedule and on demand | FEATURES DIG-01, DIG-02 | ⚠ Read as both schedule and on demand |
| 9 | Conflict notice to owner and project head | FEATURES CFL-07 | ⚠ Project head must be in WhatsApp group. Q-P10 |
| 10 | Notice and link only | FEATURES CFL-07, WA-16 | ✔ |
| 11 | Admin selects WhatsApp events | FEATURES WA-02 | ✔ |
| 12 | Cap 30, admin set | FEATURES WA-04, SET-05 | ✔ |
| 13 | Default approver: project head | FEATURES APR-01 | ✔ |
| 14 | Escalation to owner after 2 working days, admin set | FEATURES APR-05, SET-01 | ✔ |
| 15 | Reject with text, back to WIP | FEATURES APR-04, LIFE-07 | ✔ |
| 16 | Bell and My Approvals | FEATURES NTF, APR-08 | ✔ |
| 17 | Admin-only restriction | FEATURES section 2 (AD column) | ✔ |
| 18 | SLAs per project | FEATURES SET-02 | ✔ |
| 19 | Rule changes new events only, history kept | FEATURES RUL-04 to RUL-06 | ✔ |
| 20 | Client sees transmittal history and conflict status | FEATURES CLI-06, CLI-07 | ✔ |
| 21 | Magic link then password | FEATURES AUTH-01 to AUTH-03, CLI-02 | ⚠ "Password only" read as: magic link for setup and reset, password for login. Confirm |
| 22 | Conflict: subject, content, attachments | FEATURES CFL-01 | ✔ |
| 23 | Back-and-forth thread | FEATURES CFL-02 | ✔ |
| 24 | Client sees firm response | FEATURES CFL-02 | ✔ |
| 25 | Client downloads | FEATURES CLI-05, FIL-06 | ✔ |
| 26 | Reply in 3 working days, overdue on dashboard | FEATURES CFL-03, CFL-04 | ✔ |
| 27 | All formats viewable | FEATURES VIEW-01, VIEW-02 | ✔ (NWD support O4) |
| 28 | Autodesk for viewing | TECH-STACK 7; ARCHITECTURE 3.6 | ✔ |
| 29 | Viewable for all with access | FEATURES VIEW | ✔ |
| 30 | Supabase storage | ARCHITECTURE 3.1 | ✔ |
| 31 | Hostinger Docker worker, 2 vCPU, 8 GB, 100 GB | TECH-STACK 5 | ✔ |
| 32 | Credentials already held | Not in documents (by design) | ✔ |
| 33 | India | ARCHITECTURE 9.1 | ✔ (O-A4, O2) |
| 34 | Export and delete, admin only, contents, retention | FEATURES EXP-01 to EXP-08; ARCHITECTURE 3.10 | ✔ |
| 35 | NDA checkbox and upload | FEATURES NDA-01 to NDA-04 | ✔ |
| 36 | Drafters upload | FEATURES FIL-01, section 2 | ✔ |
| 37 | Naming standard decided by us | FEATURES FIL-03; SCHEMA settings | ⚠ Proposal. A-N1 |
| 38 | Transmittal per project with date | FEATURES TRN-02; SCHEMA function | ⚠ Proposal. A-T1 |
| 39 | IFC and GFC: checker and project head | FEATURES LIFE-05, REV-02 | ✔ |
| 40 | Roles as listed | FEATURES section 2 | ✔ |
| 41 | Combined roles, responsibility recorded | FEATURES APR-06, AUD-03; ARCHITECTURE 5.2 | ✔ Corrected (see section 2) |
| 42 | Admin creates accounts | FEATURES AUTH-01, CLI-09 | ✔ |
| 43 | English only | DESIGN 1, 10; TECH-STACK 10 | ✔ |
| 44 | IST | ARCHITECTURE 4; SET-06 | ✔ |

---

## 2. Corrections made in this version

| # | Where | Problem | Correction |
|---|---|---|---|
| C1 | SCOPE.md v1 | Review comments, submittals, change tracking, authority checklists, workload and PDF/Excel exports were missing although the decision was "all modules" | Added in PRD 4.1 and FEATURES (RVW, SUB, CHG, AUT, WKL, REP) |
| C2 | ARCHITECTURE 5.2 (draft) | Self-approval was blocked, which contradicts decision 41 (same person may hold both roles and remains responsible) | Changed to: allowed, recorded, and flagged in the audit view (APR-06, AUD-03). PRD APR-06 and risk table updated |
| C3 | Reference files | Multi-language, multi-tenant, shop, cart, PWA, runtime white-label and Portuguese routes do not apply | Removed (DESIGN 1, TECH-STACK 10) |
| C4 | Reference files | Therapy-specific domain components (PatientCard, ClinicalNote, PrivacyIndicator) | Replaced with drawing-control components (DESIGN 7.3) |
| C5 | Reference files | Known gaps: Inter not loaded, no reduced-motion support, mixed Angular patch versions, inline vs separate template rule | Each has a fix or an open item (DESIGN 14, DESIGN 16) |
| C6 | Reference files | Reference uses `@google/generative-ai`, which is being replaced | Not reused; `@google/genai` proposed, verify at Phase 8 (TECH-STACK 6) |
| C7 | Design (new) | Reference has no conflict thread, timeline or file viewer components, which this product needs | Added to DESIGN 7.2 and 7.3 |
| C8 | Architecture (new) | Large CAD uploads cannot pass through Netlify Functions because of payload limits | Direct resumable upload to Supabase Storage (ARCHITECTURE 3.1, ADR-05) |
| C9 | Architecture (new) | APS needs a source copy of each file for translation | Stated as open item O-A7, with a proposed deletion rule (ARCHITECTURE 9.4) |
| C10 | Architecture (new) | Working days need a holiday calendar and weekend pattern | Open item O-A1 and Q-P11; SCHEMA `holidays` table |
| C11 | Architecture (new) | Digest rows go to Gemini, which needs firm approval | Open item O-A6 (ARCHITECTURE 9.1) |
| C12 | Architecture (new) | Export archive keys: admin holds them, so loss means loss of the archive | Stated in EXP-03 and O-T3 |
| C13 | Netlify | Netlify Functions cannot run the WhatsApp connection | Worker on Hostinger (ARCHITECTURE 2, ADR-04) |
| C14 | Stale-revision measure | "Stale-revision incident" needed a definition the software can measure | Defined by FIL-05 (checksum change on an issued revision) and owner confirmation |

---

## 3. Consistency checks performed

**Method:** the document cross-reads were done by reading the documents side by side. No automated link check was run.

**Schema test run (16 Oct 2026):** `schema.sql` was loaded on a local PostgreSQL 16 database, with a stub `auth` schema standing in for Supabase Auth. It loaded with no errors. `schema_behaviour_tests.sql` was then run: 13 checks covering revision immutability, append-only audit log, admin firm-wide constraint, role-project constraint, settings uniqueness with NULLS NOT DISTINCT, rejection reason, issued-field requirement, transmittal numbering, live-sheet flag, duplicate sheet numbers, revision code format and superseded status. All 13 behaved as expected. One of the test lines was a typo in the test itself, which the database rejected correctly. Not yet tested: Supabase's own RLS policies (which need Supabase Auth) and the TRUNCATE guard.

Re-run both checks whenever the schema changes.

- Feature IDs referenced in PRD, BUILD-PHASES and IMPLEMENTATION-PLAN were checked against FEATURES.md.
- Tables named in FEATURES were checked against schema.sql, including `approvals`, `conflicts`, `transmittals`, `whatsapp_outbox`, `digests`, `exports`, `rule_versions` and `register_imports`.
- Role names are the same in every document: Admin, Project head, Discipline lead, Drafter, Checker, Client.
- Sheet states are the same in SCHEMA (enum), DESIGN (status table), FEATURES (LIFE) and ARCHITECTURE.
- Settings keys in SCHEMA match the defaults in FEATURES SET-01 to SET-08.
- Working-day SLA values match decisions 6c, 14, 26.
- WhatsApp cap (30) matches decision 12.
- Digest time (09:00 IST) matches decision 4.

**Note on `nda_records`:** the NDA is stored as a file reference on `client_orgs.nda_file_id`, not as a separate table. FEATURES NDA-01 to NDA-04 use that model. Earlier drafts mentioned a separate `nda_records` table; it is not in schema.sql. This is intentional.

---

## 4. Things the documents do not yet do

These are known gaps that will be closed when the open items are answered. They are not errors in the documents.

- Clash import format is unknown (O1). CLS-04 is written against a generic format until the lead's file is seen.
- Autodesk pricing, NWD support and copy acceptance are unconfirmed (O4, O5, O-A7).
- Hostinger location is unconfirmed (O2).
- Working-day weekend pattern and holidays are unconfirmed (O-A1).
- The Gemini model ID is not chosen until Phase 8 (by design).
- Frontend framework is unconfirmed (O-T1). The documents are written for Angular.
- Brand and dark mode are unconfirmed (O-D1, O-D3).
- Transmittal email to clients is not decided (Q-P9). The system records sending only.

---

## 5. Items that need your confirmation before Gate G0

| ID | Item | Source |
|---|---|---|
| O-T1 | Angular (matches reference) or React | TECH-STACK 11 |
| O-T5 | Where the code is hosted and CI | TECH-STACK 11 |
| O-A3 | Email provider for magic links | ARCHITECTURE 15 |
| O-A4 | Supabase India region on the plan | ARCHITECTURE 15 |
| O2 | Hostinger server location (India) | ARCHITECTURE 9.1 |
| O-A1 | Weekend pattern and holidays | ARCHITECTURE 4 |
| O-D1 | Keep Sage/Stone palette and the name "Calma estruturada" | DESIGN 16 |
| Q-P1 to Q-P12 | Open product questions | PRD 12, FEATURES 6 |
| A-R1 | "Both can" meaning project head and sheet drafter both respond | FEATURES section 2 |
| A-N1, A-T1 | Naming and transmittal patterns | FEATURES SET-03, SET-04 |
| A-S1 | No MFA in pilot | ARCHITECTURE 5.1 |
| A-W1 | 5-minute duplicate window | FEATURES WA-07 |
| A-V1 | Native CAD download for clients on issued sheets | FEATURES FIL-06 |
| A-E1 | "Client chat history" means client conflict threads | SCOPE v1, EXP |
| A-E2 | Where the export archive is stored | FEATURES EXP-04 |

---

## 6. Files in this set

| File | Contents |
|---|---|
| `DESIGN.md` | Design system adapted from the reference |
| `ARCHITECTURE.md` | System design, flows, security, deployment |
| `PRD.md` | Requirements summary, measures, scope, risks |
| `TECH-STACK.md` | Tools, versions to verify, decisions needed |
| `SCHEMA.md` | Database design, RLS outline, lifecycle values |
| `schema.sql` | Draft database schema, not executed |
| `FEATURES.md` | Feature inventory with acceptance criteria |
| `BUILD-PHASES.md` | Phases, gates, pilot plan |
| `IMPLEMENTATION-PLAN.md` | Team, workstreams, sprints, testing, release |
| `VERIFICATION.md` | This file |
| `schema_behaviour_tests.sql` | Schema behaviour checks (run on PostgreSQL 16) |
| `drawing_register_template.xlsx` | Register import template (from earlier) |

---

## 7. Build verification run log (16 Oct 2026)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | Passed, no errors |
| Domain unit tests | `npm test -w @arch-flow/domain` | 67 passed |
| Messaging unit tests | `npm test -w @arch-flow/messaging` | 35 passed |
| Web unit tests | `npm test -w @arch-flow/web` | 12 passed |
| RLS suite | `supabase/tests/run_rls_tests.sh` (PostgreSQL 16) | 31 checks passed |
| Production build | `npm run build` with placeholder env | Passed. All app and API routes compiled. |
| Playwright smoke | `npm run e2e -w @arch-flow/web` (Chromium) | 10 passed. Screenshots saved to `apps/web/test-results/`. |

### Defects found and fixed during this run

- **Middleware redirected machine routes to login.** The webhook, cron and health routes returned the login page to unauthenticated callers. Meta's handshake and Vercel Cron would have failed in production. Fixed: those three routes skip the session check and authenticate themselves. Other unauthenticated `/api/*` calls now receive a 401 JSON response instead of a redirect.
- **Register import returned a false success.** Fixed earlier: it now redirects to the review page.
- **Workload query used a column that does not exist** (`active`). Corrected to `is_active`.
- **Admin WhatsApp page read a worker heartbeat** that no longer exists. Replaced with Cloud API configuration status. Secret values are never shown.
- **Vitest picked up Playwright specs.** Fixed with a dedicated `vitest.config.ts` limited to `test/`.

### Not verified (needs live accounts)

- Sign-in, invitations and role-based screens with real users.
- Supabase Storage signed uploads with real files.
- WhatsApp Cloud API sends, delivery receipts and inbound commands with a real number and approved template.
- Gemini digest wording.
- Autodesk token, OSS upload, translation and viewer. Endpoints and viewer version are from the documentation and have not been called.
- NWD translation support.
- Vercel cron execution.

### Drift from the earlier plan

- Worker process replaced by Vercel routes plus daily cron. Per-minute outbox retries need Vercel Pro.
- whatsapp-web.js replaced by WhatsApp Cloud API (needs Meta approval for production templates).
- Hostinger and Docker removed.
- Clash import format still needs a real sample.

---

## 8. Run log: WhatsApp Web pilot, portal drawings, clash viewer (16 Oct 2026)

| Check | Result |
|---|---|
| RLS suite, migrations 000000 to 000400 on PostgreSQL 16 | Passed (`RLS TESTS PASSED`). 13 decision and upload events seeded as enabled. |
| Typecheck (all workspaces) | Passed |
| Domain, messaging unit tests | 67 and 35 passed |
| WhatsApp Web session helpers (`node --test`) | 5 passed: encrypt and decrypt, tamper and wrong-key rejection, key length, session store round trip with private zip mode |
| Web unit tests | 12 passed |
| Production build | Passed. Includes `/portal/files/[fileId]` and `/projects/[code]/issues/[id]`. |
| Playwright smoke (Chromium) | 11 passed. Adds: portal and clash pages redirect to login when signed out. |

### Not verified

- **Real WhatsApp Web login and message flow.** This needs a QR scan on the test number, which I cannot do here. `createWhatsAppWeb` (the wiring of events, send and the outbox loop) has no automated test. The session store and encryption are tested.
- **Autodesk translation and viewer**, Supabase signed-in flows, and the portal and clash pages with real data.
- **Per-minute Vercel cron** on a Pro plan.

### Decisions applied

- Upload and decision events are on by default (13 events, confirmed 16 Oct 2026).
- Client users may view PDF and CAD in the portal. CAD viewing needs the organisation's NDA flag (`allow_aps_processing`). Download needs `allow_native_download`.
- Working days Monday to Friday, no holiday list yet.
- Clash files use the same viewer as drawings. The clash export format is still undecided.

---

## 9. Run log: WhatsApp, Vercel hosting and the local stack (16 Oct 2026)

Environment: this sandbox. Egress policy refused `web.whatsapp.com`, `graph.facebook.com`,
`developer.api.autodesk.com`, `cdn.jsdelivr.net`, `api.supabase.com` and `vercel.com`. Nothing below
claims a result for those hosts.

### 9.1 Verified (automated, on a real PostgreSQL 16 database)

| Check | Result |
|---|---|
| Typecheck, all workspaces | 0 errors |
| Domain unit tests | 67 passed |
| Messaging unit tests | 35 passed (the 7 integration tests run in the API harness) |
| Web unit tests | 13 passed (adds the `x-ads-force` and translation-request tests) |
| WhatsApp Web helpers (`node --test`): encryption, tamper and wrong-key rejection, session store round trip | 5 passed |
| RLS suite, migrations 000000 to 000400 | PASSED |
| Production build | passed |
| Playwright smoke, public pages and API routes | 11 passed |
| **API harness** (`supabase/tests/api/run.sh`): migrations, PostgREST 12.2.3, Supabase gateway stub, seeds | **all passed** |
| ↳ messaging pipeline against PostgREST: fan-out, send, inbound command, stranger rejected, STOP and START, queue-only mode, encrypted session store, anon role denied | 7 of 7 |
| ↳ WhatsApp Web wiring with a fake client: QR printed, `ready` writes heartbeat, group and self messages ignored, allowlisted command answered, stranger logged and not answered, alert sent, disconnect exits non-zero | 8 subtests passed |
| ↳ signed-in browser tests (owner and client) | 9 of 9 |
| Cron route `/api/cron/tick` in the production build, 3 calls one minute apart, with the secret | 200 each time. A call without the secret is 401. |
| Digest at the configured time: three cron runs | exactly one digest created and queued |

Signed-in screenshots (apps/web/artifacts/signed-in/, not committed):
`owner-dashboard.png`, `owner-sheet.png`, `owner-clash.png` (the clash page embeds the issued PDF in the
viewer), `client-portal.png`, `client-pdf.png`.

Caveat on `owner-clash.png`: the test checks that the PDF document loads (the viewer reports page 1 of 1). The
main canvas in that capture was still rendering, so the screenshot is not a check of the drawing's pixels.

### 9.2 Real service attempted, and what happened

- **WhatsApp Web login.** `apps/whatsapp-web/src/WhatsAppWeb.js` was started with the real
  `whatsapp-web.js` and a real Chromium. The browser could not load `https://web.whatsapp.com/`
  (`net::ERR_TUNNEL_CONNECTION_FAILED`, the egress policy refused the host). The process logged the error
  and exited with code 1. **The QR code was not reached**, so the login is not verified.

### 9.3 Defects found and fixed in this round

1. Each inbound message was logged twice (`recordInbound` plus `logInbound`). Fixed: one log path.
2. The STOP confirmation was cancelled, because the opt-in check also applied to replies. Fixed: replies to
   the person are allowed, alerts and digests stay gated. Caught by the integration test.
3. `x-ads-force` was sent on every translation start, which deletes existing derivatives. Fixed: sent only on
   a retry. Caught against Autodesk's published reference.
4. A failed translation had no retry. Added: up to three attempts, counted in `files.translation_attempts`.
5. The admin WhatsApp page could not show whether the host runs. Fixed: the host writes a heartbeat every
   60 seconds, and the page shows Linked and sending, Running not linked, Not reporting, or Never reported.
6. The host did not read `.env`. Fixed: `node --env-file-if-exists`.
7. The integration test file used `import.meta`, which the TypeScript setting rejects. Fixed.
8. The default Playwright config picked up the signed-in tests, which need the harness. Excluded.
9. The signed-in harness started a stale server on port 3500 and tested the wrong build. The harness now
   refuses to start when its ports are taken.

### 9.4 Not verified, and what would verify it

| Item | Why it is not verified | What is needed |
|---|---|---|
| QR code scan, linked session, real send and receive on WhatsApp | `web.whatsapp.com` refused by the egress policy | Allow `web.whatsapp.com` for the host (or run the host on a machine with access), then one QR scan on the test number |
| Cloud API (client-facing) sends and the Meta webhook | `graph.facebook.com` refused; no Meta app | Meta app, approved template, and access to `graph.facebook.com` |
| Autodesk translation, manifest, viewer | `developer.api.autodesk.com` refused | APS credentials in `.env` and access to the host. Viewer path `viewers/7.*` not loaded in a browser. EMEA data needs `NEXT_PUBLIC_APS_VIEWER_API=streamingV2_EU`, not tested. |
| Vercel deployment and the per-minute cron on Pro | `vercel.com` refused. The cron route is verified locally only | Deploy, then check the Cron Jobs tab after the first minute |
| Real Supabase Auth, Storage and the project's RLS with real users | No project link yet. The local stack replaces Auth and Storage with a stub gateway; PostgREST is the real REST layer | Project URL and keys in `.env`; run the migrations on that project |
| GitHub Actions job `api-integration` | Written, not run on GitHub | First run on GitHub after push |

The viewer script path, the Autodesk endpoints and the cookie format were checked against the published
documentation (Autodesk pages found by web search) and the `@supabase/ssr` source. They were not run live.

### 9.5 Open decisions and items (unchanged)

- Gemini: which data may leave the firm. Keep to counts and sheet numbers until decided.
- Written acceptance of the WhatsApp Web ban risk for the pilot.
- Holiday list: Monday to Friday until given.
- Clash export format: still undecided. Send a sample CSV or XLSX.

---

## 10. Decision trace, corrections and change log (updated 16 Oct 2026)

### 10.1 Decisions made in this round, traced to the documents

| Decision (owner, 16 Oct 2026) | Where it is written | How it is checked |
|---|---|---|
| Hosting on Vercel Pro (per-minute checks) | ARCHITECTURE 1, 7, 11; TECH-STACK 3; HOSTING 2 | Cron route tested locally, three runs; schedule in `vercel.json`. Not run on Vercel (network). |
| WhatsApp pilot: QR login, dedicated test number, owner and internal allowlist | WHATSAPP 1 to 3; FEATURES WA-01, WA-12; TECH-STACK 4 | Wiring tests (8 checks), encrypted session store, real Chromium launch. QR scan not done (network). |
| Client-facing WhatsApp later, through the Cloud API | WHATSAPP 8; ARCHITECTURE 10 | Webhook signature tests. Not live. |
| Alerts on for every upload and for decisions: approval approved and rejected, conflict answered, transmittal sent, revision issued | WHATSAPP 4.1; FEATURES WA-02; migration `20261016000400` | Database check: 13 events enabled. |
| STOP confirmation must reach the person | WHATSAPP 5; FEATURES WA-08 | Integration test (STOP, reply sent, alerts blocked, START restores). |
| Working days Monday to Friday, no holiday list yet | FEATURES SET-08; SCHEMA (holidays) | Not tested against a holiday list. Open. |
| Autodesk keys in `.env` (not in code or chat) | HOSTING 5; `.env.example` | Keys not yet provided. Open. |
| NWD cloud conversion allowed | ARCHITECTURE 10; TECH-STACK 5 | Scope for firm files to confirm. |
| Clients may view CAD in the portal, and PDF; download when allowed | FEATURES VIEW-05, CLI-05; DESIGN 17 | Signed-in client tests (portal list, PDF, CAD status, NDA block). |
| Clash files use the same viewer as drawings | DESIGN 17; FEATURES CLS-05 | Signed-in owner test (clash page with the PDF). |
| Supabase project: link and keys to be shared by the owner | HOSTING 4; TECH-STACK 2 | Open until the project is provided. |

### 10.2 Corrections to earlier documents

| Earlier statement | Corrected to | Where |
|---|---|---|
| Netlify hosts the web app | Vercel Pro | TECH-STACK 3, 7 |
| Hostinger VPS or container runs the worker | WhatsApp host on the owner's machine or a VM, under pm2 | BUILD-PHASES 0, 3, 7; PRD 5; HOSTING 3 |
| Docker image for the worker | Not used (Docker not available; host runs Node) | TECH-STACK 7 |
| Worker runs the scheduled jobs | Messaging runtime runs them in the Vercel cron every minute, and the host sends | ARCHITECTURE 2, 7 |
| Daily cron (Hobby) | Every minute on Vercel Pro | HOSTING 2; ARCHITECTURE 7 |
| WhatsApp through the Cloud API only | Two channels: QR-linked pilot on the host, Cloud API for production | WHATSAPP 1 |
| Decision 3 (test number now, Cloud API later) | Pilot on the host and production on Cloud API (both now) | FEATURES Appendix C |
| Decision 31 (Hostinger Docker worker) | Superseded | FEATURES Appendix C |
| Schema "not executed" | Applied and tested on PostgreSQL 16 locally; `schema.sql` regenerated from the migrations | SCHEMA; schema.sql |
| Behaviour tests printed "expect" labels only | Each check passes or fails; 27 checks | schema_behaviour_tests.sql |
| Translation sent `x-ads-force` on every start | Only on retry | ARCHITECTURE 5; HOSTING 5 |
| No retry for failed translation | Retry up to three attempts | FEATURES VIEW-03 |
| Clients not shown CAD in the portal | Shown when the NDA flag allows | FEATURES VIEW-05 |
| Owner alert on WhatsApp disconnect | Not built. The admin page shows the state. | BUILD-PHASES 3; FEATURES WA-11 |

### 10.3 Change log (16 Oct 2026)

| Change | Reason | Documents updated |
|---|---|---|
| WhatsApp Web host (`apps/whatsapp-web`): QR login, encrypted session, commands, heartbeat, pm2 config | Pilot channel the owner asked for | WHATSAPP (new), HOSTING (new), ARCHITECTURE, TECH-STACK, FEATURES, BUILD-PHASES |
| Messaging runtime: transport injection, queue-only mode, heartbeat, inbound logged once | Vercel cannot hold the session; one sender only | ARCHITECTURE 2, 3, 7, 8 |
| STOP reply allowed after STOP; alerts stay blocked | Confirmation must arrive | WHATSAPP 5; FEATURES WA-08 |
| Vercel cron every minute (Pro) | Owner's Pro plan | HOSTING 2; TECH-STACK 3 |
| Migration `20261016000400`: session table, 13 alert events on | Owner's decision list | SCHEMA; schema.sql |
| Translation retry and retry-only `x-ads-force`; viewer API region setting | Autodesk reference and EMEA data | FEATURES VIEW-03; HOSTING 5; DESIGN 17 |
| One drawing viewer; client portal file view; clash detail page | Owner's request for one viewer and client CAD | DESIGN 17; FEATURES CLI-05, CLS-05; ARCHITECTURE 5 |
| Admin WhatsApp page shows host status | Vercel cannot see the host | DESIGN 17; FEATURES WA-11, WA-12 |
| API harness (PostgREST, gateway stub, integration, wiring, signed-in tests) and CI job | Verify the not-yet-tested paths locally | IMPLEMENTATION-PLAN "As built"; TECH-STACK 6; HOSTING 7 |
| Behaviour tests automated; schema regenerated | Docs must match what runs | SCHEMA; schema.sql; schema_behaviour_tests.sql |
| Playwright config: signed-in tests run only through the harness | Default run failed without the harness | README; TECH-STACK 6 |
| `.env.example` grouped by role; unused variables removed | Clear what each machine needs | HOSTING; README |

### 10.4 What was verified for these documents

- The "built" statuses in FEATURES, BUILD-PHASES and TECH-STACK were checked against code, tests or the local stack. The check was targeted (each area, and each claim that something is not built), not a line-by-line audit of the long plan text, which is historical.
- Features not built are named as not built: EXP (export, delete, reopen), the NDA file upload, the owner disconnect alert, the email fallback, the over-capacity digest flag, the admin health page, and the digest late note.
- Stale terms (worker, Netlify, Hostinger, Docker, daily cron) are removed from the plan documents, except where a line states the correction.

### 10.5 Open items that block the pilot

1. Supabase project link and keys (owner to share).
2. Autodesk credentials in `.env` (owner to provide).
3. Test phone and a QR scan on the dedicated number; network access to `web.whatsapp.com` on the host.
4. Written acceptance of the WhatsApp Web ban risk.
5. Which data may go to Gemini (or keep it off).
6. Holiday list, or confirmation that none applies.
7. Clash export format (sample file).
8. Supabase and Vercel regions (data residency, ARCHITECTURE 10).

