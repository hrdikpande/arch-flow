# Tech Stack

**Version:** 3.0, 16 Oct 2026. Supersedes v2 (Netlify, Hostinger, Docker, and the whatsapp-web.js worker).
**Status key:** *In use* (built and tested) · *Decided* (chosen, not yet live) · *Open* (needs an owner input) ·
*Reference* (used only for testing or as a reference) · *Proposed* (optional, not committed) · *Not used* (deliberately removed or rejected).

## 1. Application

| Tool | Version | Role | Status | Notes |
|---|---|---|---|---|
| Next.js | 15.5 (App Router) | Web app, server actions, route handlers | In use | Secrets stay on the server |
| React | 19 | UI | In use | |
| Tailwind CSS | v4 | Styling, design tokens in `globals.css` | In use | See DESIGN.md |
| TypeScript | 5.9 | All app and package code | In use | |
| `@arch-flow/domain` | local | Business rules (lifecycle, SLA working days, naming, revisions, imports, critical rules) | In use | Pure functions, 67 unit tests |
| `@arch-flow/messaging` | local | Outbox, fan-out, commands, digests, escalations, checks, transports | In use | 35 unit tests, 7 integration tests against a database |
| pdf-lib | 1.17 | PDF reports (register, dashboard) | In use | A4 landscape tables |
| xlsx (SheetJS) | 0.18 | Excel imports and reports | In use | Register, issues, transmittals, changes |

## 2. Data, identity and storage

| Tool | Role | Status | Notes |
|---|---|---|---|
| Supabase Postgres | Database with row-level security on every table | In use (local); project **open** | Migrations `20261016000000` to `…000400`. 40 tables, 45 policies. Project link and keys pending (O-A4 region still to confirm). |
| Supabase Auth | Invitations (magic link), password login, reset | In use (local stub); **open** | Local test uses a stub gateway. Real Auth not yet exercised. |
| Supabase Storage | Private buckets `drawings`, `imports`; signed links | In use (local stub); **open** | Signed links expire in 5 minutes (drawings) |
| `@supabase/ssr`, `@supabase/supabase-js` | Session cookies, data access | In use | Cookie format checked against the library source |
| PostgREST 12.2.3 | REST layer behind Supabase | Reference | Used by the local API harness only |
| PostgreSQL 16 | Local database for RLS and behaviour tests | Reference | `supabase/tests/`, `docs-and-sql-ref/schema_behaviour_tests.sql` |

## 3. Hosting and operations

| Tool | Role | Status | Notes |
|---|---|---|---|
| Vercel Pro | Web app and cron (`* * * * *` on `/api/cron/tick`) | Decided (plan confirmed 16 Oct) | Per-minute schedule needs Pro. Not yet deployed from here (no access). |
| Always-on host (owner's machine or a small VM) | Runs the WhatsApp Web session process | Decided | Vercel cannot hold the session. See HOSTING.md. |
| pm2 | Keeps the host process running; restarts after crashes and disconnects | Decided | `apps/whatsapp-web/ecosystem.config.cjs` |
| Node.js | 22.19 or newer | In use | Host and CI |
| GitHub Actions | CI: typecheck, unit, build, smoke (e2e), API integration | In use | `api-integration` job not yet run on GitHub |

## 4. WhatsApp

| Tool | Role | Status | Notes |
|---|---|---|---|
| `whatsapp-web.js` 1.34 | Pilot channel: owner and internal allowlist, dedicated test number, QR login | Decided for the pilot | Unofficial API. Ban risk must be accepted in writing (open). Login verified up to the network step only. |
| Chromium | Headless browser used by `whatsapp-web.js` | In use on the host | Set `WA_CHROMIUM_PATH` if needed |
| `qrcode-terminal` | Prints the login QR code on the host terminal | In use | |
| AES-256-GCM (Node `crypto`) | Encrypts the stored WhatsApp session | In use | Key in `WA_SESSION_KEY`; losing it means re-scanning |
| WhatsApp Cloud API (Meta Graph v21.0) | Client-facing messages, production | Decided; code built; **open** | Needs Meta app, approved template and a phone number. Not verified live. |
| Meta webhook signature (HMAC SHA-256) | Verifies Cloud API callbacks | In use | Tested with signed and unsigned payloads |

## 5. AI and CAD

| Tool | Role | Status | Notes |
|---|---|---|---|
| Gemini (`@google/genai`) | Optional digest wording, server-side only | Proposed; **open** | Owner must decide which data may leave the firm. Every number is checked against the source. Off unless `GEMINI_API_KEY` and `GEMINI_MODEL` are set. |
| Autodesk Platform Services | Upload (signed S3), translate to SVF2, token for viewer | Decided; credentials **open** | Owner confirmed NWD cloud conversion is allowed (16 Oct). Endpoints checked against Autodesk's reference, not called live. |
| Autodesk Viewer SDK v7 | Browser viewer for DWG, RVT, IFC, NWD | Decided | Script path `viewers/7.*` not loaded in a browser yet. EMEA: `streamingV2_EU` via `NEXT_PUBLIC_APS_VIEWER_API`. |

## 6. Testing and quality

| Tool | Role | Status |
|---|---|---|
| vitest | Unit tests (domain, messaging, web), messaging integration tests | In use |
| `node --test` | WhatsApp Web helpers and wiring tests | In use |
| Playwright (Chromium) | Smoke tests (11) and signed-in browser tests (9) | In use |
| Local API harness (`supabase/tests/api/run.sh`) | Full local stack with PostgREST and a Supabase gateway stub | In use |
| RLS suite (`supabase/tests/run_rls_tests.sh`) | 31 row-level security checks | In use |
| Behaviour tests (`schema_behaviour_tests.sql`) | 27 database rule checks, pass or fail | In use |

## 7. Not used, and why

| Tool or option | Decision |
|---|---|
| Hostinger (hosting and worker) | **Removed** 16 Oct. Vercel hosts the web app. The WhatsApp host is the owner's machine or a VM. |
| Docker | **Not used.** Not available in the build environment. The host runs Node directly under pm2. |
| Netlify | **Removed** 16 Oct. Replaced by Vercel Pro. |
| Long-running worker on Vercel | **Not possible.** Vercel functions cannot hold a Chromium session. |
| OpenWA | **Reference only.** Not deployed. Its own README recommends the official Cloud API for regulated work. |
| A separate message queue (Redis, SQS) | **Not used.** The `whatsapp_outbox` table is the queue. Volume does not justify another service. |
| Email for alerts | **Not used** for routine alerts (NTF-04). Email only for health alerts and magic links. |
| Client-side AI or AI sending messages | **Not used.** Gemini drafts text only and has no send rights. |
