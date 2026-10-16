# Verification Log — Documents v2 against our decisions

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
