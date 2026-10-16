# Implementation Plan — Drawing Control & Alerts

**Status:** Draft for approval
**Companion:** BUILD-PHASES.md (what each phase delivers), FEATURES.md (what each feature must do), TECH-STACK.md (tools), ARCHITECTURE.md (design)

This document says **how** the build happens: who does what, how work is organised, how code gets tested and released, and how the owner stays in control.

---

## 1. Team

The team is **not yet confirmed**. The plan assumes the roles below. Fill in names before Gate G0.

| Role | Assumed effort | Responsibilities | Name |
|---|---|---|---|
| Lead developer (full stack, owns architecture and reviews) | Full time | Schema, API, WhatsApp host, code review, release | TBC |
| Developer (frontend, Angular) | Full time | Web app, `ds-*` components, client portal | TBC |
| Developer (backend and messaging) | Full time | API functions, WhatsApp host, digest, export | TBC |
| Designer | Part time (about 2 days a week in phases 0–2, then as needed) | Screens, `ds-*` gaps, accessibility review | TBC |
| QA | Part time (about 2 days a week from Phase 1) | Test plans, E2E, acceptance tests, UAT support | TBC |
| Product owner (firm side) | About 2 hours a week, plus gate reviews | Decisions, acceptance, pilot management | Owner |
| Project lead (firm side) | About 2 hours a week in phases 1–2 | Register data, import checks | TBC |

**If the team is one developer:** the timeline in BUILD-PHASES.md roughly doubles. Phase order stays the same. The owner is told before the start, and the pilot date is reset.

---

## 2. Workstreams

Work is grouped into six streams. Each feature belongs to one main stream.

| Stream | Scope | Main owner | Feature prefixes |
|---|---|---|---|
| A. Data and security | Schema, RLS, audit, migrations | Lead developer | AUTH, PRJ, SET, AUD |
| B. Core product (web app) | Register, lifecycle UI, approvals, issues, dashboards | Frontend developer | REG, LIFE, REV, APR, CLS, RFI, SUB, CHG, RVW, AUT, WKL, DSH |
| C. Files and viewing | Uploads, naming, PDF, Autodesk, NDA | Backend developer | FIL, VIEW, NDA, IMP |
| D. Client portal and conflicts | Client routes, views, conflict thread | Frontend developer | CLI, CFL, TRN (client side) |
| E. Messaging and WhatsApp host | WhatsApp, outbox, commands, digest, Gemini, escalation jobs | Backend developer (messaging) | WA, DIG, ESC, NTF, SYS |
| F. Export, rules and admin | Export, delete, reopen, rules editor, reports | Lead developer | EXP, RUL, REP, SET, AUD |

**Design stream** runs alongside B and D: the designer supplies screens for each phase one phase ahead of development (so screens for Phase 3 are ready at the end of Phase 2).

---

## 3. Sprint plan

Two-week sprints. Each sprint has a demo to the product owner on the last Thursday, and a retrospective.

| Sprint | Weeks | Phase | Main work |
|---|---|---|---|
| S0 | 1–2 | 0 | Environments, auth, design base, CI, staging |
| S1 | 3–4 | 1 | Projects, users, roles, settings, register list and detail |
| S2 | 5–6 | 1 (end), 2 (start) | RLS test suite, revisions, import validation, upload start |
| S3 | 7–8 | 2 | Import preview and confirm, uploads with resume, PDF viewer |
| S4 | 9–10 | 2b, 3 (start) | Autodesk translation and viewer, NDA rules, guards start |
| S5 | 11–12 | 3 | Guards, issue with supersession, approvals, bell, escalation, messaging skeleton |
| S6 | 13–14 | 4 | Rules editor, clashes, RFIs, transmittals |
| S7 | 15–16 | 4 (end), 5 (start) | Submittals, change tracking, review, checklists, dashboard, client invitations |
| S8 | 17–18 | 5, 6 | Client portal pages, conflicts thread, working-day rule |
| S9 | 19–20 | 7 | WhatsApp channel, outbox, caps, commands, health |
| S10 | 21–22 | 8 | Digest, Gemini, validation, scheduled runs |
| S11 | 23–24 | 9, 10 | Admin screens, audit, reports, export, delete, reopen |
| S12 | 25–26 | 11 | Hardening, accessibility, security review, UAT, runbook |
| — | 27–32 | Pilot | Six weeks of pilot, weekly review, exit decision |

Sprint dates depend on the start date and the team (section 1). The table shows relative weeks only.

**Work tracking:** one board with columns: Backlog, Ready, In progress, In review, QA, Done. Each card has a feature ID from FEATURES.md. A card cannot move to Done without its acceptance criteria checked.

---

## 4. Environments and release

| Environment | Purpose | Who can deploy | Data |
|---|---|---|---|
| Local | Development. Local API harness (PostgREST and the gateway stub), WhatsApp host with the test number (QR) | Developers | Seeded fake data only |
| Development | Shared, continuously deployed from the main branch | Automatic on merge | Seeded fake data |
| Staging | Acceptance tests, owner demos, pilot rehearsal | Lead developer, on tag | Fake data, then the register dry run (non-client projects only) |
| Production | Pilot and after | Lead developer, after gate sign-off | Real data |

**Rules**
- Production deploys happen only after the gate for that phase is signed off.
- No production data on developer machines.
- Client drawings are never used in staging until NDA and Autodesk checks (O3, O-A7) are closed.

**Release steps**
1. Tag a release on main (`v0.x.y`).
2. Build and test in CI.
3. Deploy to staging. Run the automated suite and the smoke test (sign-in, open a register, upload a small PDF, approval round trip).
4. Owner or lead reviews the gate checklist for the phase.
5. Database migrations: backup taken, migration run, verified.
6. Deploy to production (Vercel Pro production deploy, Supabase migrations, WhatsApp host restarted on the same commit).
7. Smoke test on production with an internal test account.
8. Announce in the decision log.

**Rollback:** promote the previous Vercel deployment (instant), restart the WhatsApp host on the previous commit tag, set `MESSAGING_TRANSPORT` to empty to stop all sends at once, and do not roll back migrations: write a forward fix instead. Each migration has a written "undo" note checked in review.

---

## 5. Code and review

- **Branches:** short-lived feature branches from main. Named by feature ID, for example `feat/REG-02-create-sheet`.
- **Commits:** small and descriptive. One concern per commit.
- **Pull requests:** every change is reviewed by one other person. Lead developer reviews schema, RLS and anything touching money, approvals or WhatsApp.
- **Definition of Done** (for each feature):
  - Acceptance criteria in FEATURES.md pass (automated where possible, documented manual test where not).
  - Unit tests for business rules.
  - API route tests, including refused access for each role that should not reach it.
  - Audit entry written for each state-changing action (AUD-04).
  - No secrets in code; no `console.log` of personal data.
  - Accessibility check on new screens (axe plus keyboard pass).
  - Documentation updated (FEATURES.md status, SCHEMA.md if tables change).
  - Reviewed and merged.
- **Code style:** ESLint and Prettier (TECH-STACK.md, section 9). CI fails on lint errors.

---

## 6. Testing strategy

| Level | What | Tools | When |
|---|---|---|---|
| Unit | Business rules: state machine, working days, transmittal numbering, digest validator, naming check | Karma/Jasmine or Vitest (O-T2) | Every commit |
| Database | RLS policies, triggers (immutability, audit append-only), functions (transmittal number) | Supabase local stack and SQL tests | Every commit touching SQL |
| API | Each endpoint: success, validation failure, refused role, refused client | Test runner with Supabase local | Every commit |
| Messaging and host | Outbox dedupe, caps, retries, STOP/START, command parsing, digest rendering, host wiring | Test runner, fake WhatsApp adapter | Every commit |
| WhatsApp integration | Real messages on the test number: alert, command, STOP, START, reconnect | Manual script plus checklist | Each release touching WhatsApp, and before Gate G7 |
| Autodesk integration | Translation and viewing of one sample file per format | Test account, non-client files only | Before Gate G2b, and on each APS change |
| Gemini validation | Validator test set (50+ inputs) and injection set | Unit tests with recorded fixtures | Phase 8 and any prompt change |
| End-to-end | Main journeys (PRD, section 7): owner morning, upload, approval, issue, client conflict, export | Playwright, Chromium | Nightly on staging, and before each gate |
| Accessibility | Automated scan per screen; keyboard and screen reader pass on main screens | axe-core via Playwright; manual | Each phase, and Phase 11 full pass |
| Performance | Register with 5,000 sheets; dashboard; upload throughput | Scripted load on staging | Phase 11 |
| Security | Role-by-route matrix; secret scan; dependency audit; HMAC and rate limit tests | Scripts and manual review | Phase 1 (start), Phase 11 (full) |
| Restore | Backup restore into an empty staging project; timed | Supabase restore plus checklist | Phase 10 |
| UAT | Owner and internal group run the journeys on pilot data | Manual scripts from PRD section 7 | Phase 11 |

**Test data:** a seeded dataset with 3 projects, 300 sheets, 40 revisions with files, 20 clashes, 30 RFIs, 10 conflicts, 5 users per role, and 2 client orgs (one with NDA). The dataset is versioned and rebuilt by script. It contains no real names or drawings.

**Test-first for security:** the role-by-route matrix is written before the policies. The expected result for each cell is recorded first, then the test runs.

---

## 7. Data migration and cutover

| Step | When | Who | Check |
|---|---|---|---|
| 1. Agree register export format (template A4) | Before Phase 2 | Project lead | Template signed off |
| 2. Dry run on sample projects | Gate G2 | Project lead and developer | Error report reviewed; no silent drops |
| 3. Full register import on staging | Before Gate G4 | Project lead | Counts match the source spreadsheet |
| 4. Register freeze and import on production | Week 0 of pilot, after G11 | Project lead, developer | Counts match; owner signs off |
| 5. Old tracker kept read-only for one month | Pilot | Owner | Used as a reference during the pilot |

**Cutover rule:** during the pilot, the register lives in the software. The old tracker is read-only. Any change in the old tracker is entered in the software the same day, or it's lost, so this must be stated to all users at onboarding.

---

## 8. Training and rollout

| Audience | Training | When |
|---|---|---|
| Owner | 60-minute walkthrough; admin panel; rules; WhatsApp settings; export | Week 0 of pilot |
| Project heads | 45 minutes: approvals, conflicts, transmittals, dashboard | Week 0 of pilot |
| Drafters and checkers | 30 minutes: upload, naming, status, approval requests | Week 0 of pilot, per project |
| WhatsApp group (3–4 people) | 15 minutes: alerts, commands, STOP and START, what a link does | Week 0 of pilot |
| Clients (if pilot includes portal) | 20-minute walkthrough, with written guide | Week 4 of pilot, per client |

**Guides:** two pages per role, in English, with screenshots from staging. Written in Phase 11.

**Support during pilot:** one named contact (developer on call during working hours IST), response target same working day for P0 issues.

---

## 9. Governance

- **Weekly product review** with the owner (30 minutes): sprint demo, decision log, open questions, risks.
- **Decision log** kept in the repository (`docs/decisions.md`): each decision with date, who decided, and the feature IDs it affects.
- **Change control:** any change to a P0 feature, the scope, the schedule or the budget goes to the owner in writing. The owner approves or rejects in the decision log.
- **Gate reviews** as in BUILD-PHASES.md, section 4. A gate is passed only in writing.
- **Risk register** reviewed every two weeks (PRD section 9). Owner sees the top five risks.
- **Cost tracking:** Supabase, Vercel Pro, Autodesk and Gemini usage reviewed weekly during build and pilot, against the plan confirmed in O5 and O-A9.

---

## 10. Quality gates for security and privacy

- Secrets: none in the repository. Secret scan in CI.
- Dependencies: audit in CI. Critical or high findings block release unless the owner accepts the risk in writing.
- Client data: client role tests run on every release (CLI-08).
- Personal data in logs: none. Logs use user IDs and sheet numbers only.
- WhatsApp: no client text, no files, no AI in command replies (WA-16, CFL-07, WA-10).
- Export: encryption key never stored in the system (EXP-03).

---

## 11. Risks specific to the build

| Risk | Mitigation | Owner |
|---|---|---|
| Team smaller than assumed | Re-estimate at G0; move pilot date with owner agreement | Lead developer |
| Autodesk terms or cost block viewing | Confirm O5 and O3 before Phase 2b; PDF fallback for all formats | Owner |
| WhatsApp restriction during pilot | Dedicated number, caps, pacing; in-app fallback; Cloud API plan started early (budget for template approval time) | Lead developer and owner |
| Register data worse than expected | Validation preview; project lead time booked in Phase 2 | Project lead |
| Scope creep from P1 items | P1 items gated in Phase 4; owner chooses what moves to pilot week 1 | Owner |
| Working-day rules disputed | O-A1 confirmed before G3; test table signed off | Owner |
| Gemini cost or quality | Fallback always available; cost tracked weekly | Lead developer |
| Key person absence | Pairing on schema, WhatsApp host and RLS; documented runbooks (WHATSAPP.md, HOSTING.md) | Lead developer |

---

## 12. Definition of done for the pilot

The pilot is ready when:
1. Gate G11 is signed off.
2. The three measures have baselines recorded (PRD, 3.2).
3. All users in the pilot have logged in and completed the training.
4. The WhatsApp group has confirmed opt-in in writing.
5. The owner has the runbook and knows how to re-link WhatsApp and restore a backup.
6. Support contact and response target are agreed.

---

## 13. Handover after pilot

If the pilot is expanded:
- Source code, infrastructure settings (without secrets), migrations, test data and runbooks are handed over to the firm, or kept under a support agreement the owner signs.
- Secrets are rotated and held by the firm's named admins (not the developers).
- Documentation updated to match what was built: FEATURES.md statuses, SCHEMA.md, ARCHITECTURE.md, runbook.
- A post-pilot review is recorded in the decision log: what worked, what did not, what changes before expansion.


## As built: testing, CI and release (updated 16 Oct 2026)

| Layer | What runs | Where | Status |
|---|---|---|---|
| Typecheck | `npm run typecheck` (all workspaces) | CI job `test` | In use |
| Domain and messaging unit tests | vitest, 67 and 35 tests | CI job `test` | In use |
| WhatsApp Web helpers | `node --test`, encryption and store | CI job `test` | In use |
| Build | `npm run build`, placeholder environment | CI jobs `test` and `e2e` | In use |
| Smoke (browser) | Playwright, 11 tests, public pages and routes | CI job `e2e` | In use |
| RLS | `supabase/tests/run_rls_tests.sh`, 31 checks on PostgreSQL 16 | Local | In use (not yet in CI) |
| Behaviour | `docs-and-sql-ref/schema_behaviour_tests.sql`, 27 checks | Local | In use (not yet in CI) |
| API harness | `supabase/tests/api/run.sh`: migrations, PostgREST, gateway stub, 7 integration tests, wiring tests, 9 signed-in browser tests | CI job `api-integration` | Written; first run on GitHub pending |

**Release order (as built):**

1. Merge to `main`. CI jobs must pass (`test`, `e2e`, and `api-integration` once it has run).
2. Apply new migrations to the Supabase project, in name order. Each migration is written to be re-runnable (`if not exists`, `on conflict`).
3. Vercel production deploy (Pro). Check `/api/health`. Cron runs every minute.
4. WhatsApp host: pull `main`, `npm ci`, restart with pm2. Check the admin page shows Linked and sending.
5. Smoke check: owner sends `help`, and an upload produces an alert.

**Rollback (as built):** no down-migrations exist. Roll back the app by promoting the previous Vercel deployment and restarting the host on the previous commit. To stop every WhatsApp send at once, clear `MESSAGING_TRANSPORT` on Vercel. Database changes are fixed forward with a new migration.
