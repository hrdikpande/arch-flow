# arch-flow

Drawing control and alerts for design and engineering firms. The system is the single source of truth for drawing status, revisions, approvals, clashes, RFIs, transmittals and client conflicts across hospital projects. It sends WhatsApp alerts and a morning digest to the owner and a small internal group.

It does not design, check compliance, or edit CAD files.

Specifications are in [`docs-and-sql-ref/`](docs-and-sql-ref/): PRD, features, architecture, design system, schema, build phases and the verification log.

## Repository layout

```
apps/web/          Next.js (React) web app: internal workspace and client portal
apps/worker/       WhatsApp worker: outbox, inbound commands, digests, escalations (Docker on Hostinger)
packages/domain/   Business rules: lifecycle guards, working days, naming, rules, digest, AI validation
supabase/          Migrations (schema, read policies) and behaviour tests
docs-and-sql-ref/  Specifications (PRD, features, architecture, design, schema, phases)
scripts/           Bootstrap SQL for the first admin
```

## Decisions implemented

| Topic | Decision |
|---|---|
| Frontend | Next.js (React), App Router, Tailwind CSS v4, design tokens from `DESIGN.md` |
| Brand | arch-flow |
| Hosting | Netlify (web app and server functions), Supabase (database, auth, files, India region), Hostinger VPS (WhatsApp worker) |
| Pilot channel | whatsapp-web.js on a dedicated test number, owner and up to four internal people, opt-in confirmed in writing |
| Production channel | Meta WhatsApp Cloud API (adapter to be added; the outbox does not change) |
| Alerts | Every upload and every decision is immediate, subject to the daily cap (30) and the admin's event switches |
| Digest | 09:00 IST, same firm digest for everyone with a personal section; on demand with `digest` |
| Approvals | Changes to issued sheets need a project head; escalation to the owner after 2 working days |
| Conflicts | Client raises subject and content; reply within 3 working days; WhatsApp notice has no client text |
| Client login | Invitation link to set a password, then password login |
| Export and delete | Admin only (planned, see below) |

## Interpretations to confirm

- "All modules" means P0 and P1 plus the client portal.
- "Decision" for immediate alerts means approvals, rejections, conflict responses, transmittals sent and revisions issued.
- "Both can" means a project head and a drafter on the sheet can both respond to conflicts.
- Working days: placeholder Monday to Friday, no holidays. **Open (O-A1):** the weekend pattern and holiday list are configured in Admin > Settings and must be confirmed.
- Autodesk viewing: **open (O4, O5, O3):** NWD support, pricing and NDA permission are unconfirmed. The viewer is not built yet (see below).
- Clash export format: **open (O1):** the clash import is not built until the format is known.
- Hostinger location: **open (O2):** confirm the server is in India.

## What is built

- Sign-in with password, invitation and password reset links (Supabase Auth).
- Projects, users and roles (admin, project head, discipline lead, drafter, checker, client). Clients see only their projects and issued drawings.
- Register: sheets, the state machine with plain-language guard messages, revisions, issue (supersedes the previous revision and creates a transmittal), change requests that need project-head approval.
- Register import from the downloadable template: validation preview, row errors, confirm.
- File upload straight to storage (signed URL), SHA-256 recorded, naming check against the standard.
- Approvals: approve, or reject with a reason; the drafter's sheet returns to work.
- Clashes (critical set by owner rules), RFIs, transmittals (mark as sent).
- Client conflicts: raise, threaded replies, close, overdue flag.
- Admin: SLAs, daily cap, digest time, holidays, weekend days, naming and transmittal patterns, users, client organisations, WhatsApp recipients and opt-in, event switches, critical rules (versioned), audit log.
- Worker: outbox sender with caps, repeat check, pacing and retries; event fan-out; inbound commands (today, overdue, critical, digest, help, STOP, START); digest with Gemini text validated before use; escalations and overdue conflict notices; health endpoint.
- Tests: 58 domain tests and 23 worker tests. Database behaviour tests in `supabase/tests`.

## Not built yet (be explicit before pilot)

- Autodesk drawing viewer and translation (DWG, RVT, IFC, NWD). PDF files are stored and downloadable; in-browser viewing is not built.
- Export, delete and read-only reopen of a project (EXP-01 to EXP-08).
- Register import of revision history (only the current revision is imported).
- Review comments, submittals, change tracking, authority checklists, workload and PDF/Excel reports.
- WhatsApp Cloud API adapter (production channel).
- Overdue RFI and stale-revision WhatsApp jobs (dashboard shows them; the worker does not send them yet).
- Resumable uploads for very large files (currently a single upload per file).
- Row-level security policies beyond the read policies in `supabase/migrations` (the app uses the service role and enforces rules in code; policies must be tested before go-live).
- Client email notifications, MFA (not in pilot).

## Setup

Requirements: Node 22.19+, npm 10+, a Supabase project in the India region (staging first), and Docker for the worker.

```bash
npm install
cp .env.example apps/web/.env.local   # web settings; the worker reads the same keys from its environment
# Fill in the Supabase URL and keys. Only the NEXT_PUBLIC_ values reach the browser.
npm run typecheck
npm test                          # domain and worker unit tests
npm run build                     # placeholder env is enough for a build
```

### Database

1. Create the Supabase project (staging first). Confirm the India region.
2. Apply `supabase/migrations/*.sql` in order (SQL editor or the Supabase CLI).
3. Optionally run `supabase/tests/schema_behaviour_tests.sql` on a scratch database to check the rules.
4. Create the first admin: create the user in Supabase Auth, then run `scripts/bootstrap-admin.sql` with their email.

### Web app (Netlify)

1. Connect the repository in Netlify. The build command and plugin are in `netlify.toml`.
2. Set the environment variables from `.env.example` (web section) in Netlify. The service role key goes in Netlify's secret variables only.
3. Set `APP_URL` to the Netlify site URL and add it to Supabase Auth's redirect allow-list (`/auth/callback`).

### Worker (Hostinger VPS, Docker)

```bash
docker build -f apps/worker/Dockerfile -t arch-flow-worker .
docker run -d --name arch-flow-worker --restart unless-stopped \
  --env-file .env -v arch-flow-session:/app/apps/worker/.wwebjs_auth \
  -p 8080:8080 arch-flow-worker
docker logs -f arch-flow-worker      # the QR code prints here on first start
```

Scan the QR code with the dedicated test number (WhatsApp, Linked devices). The owner must accept the ban risk in writing before the test starts. Only opted-in recipients receive messages; see Admin > WhatsApp.

## Security notes

- The service role key is used only on the server (Netlify functions and the worker). It is never sent to the browser.
- Every server action checks the user's role on the project before it writes. Clients cannot reach internal pages.
- Audit entries are append-only (database triggers). Every state change writes an audit entry and an event.
- The WhatsApp session is stored on a Docker volume. Encrypt the host volume (O-T4).
- Gemini is off until `GEMINI_API_KEY` and `GEMINI_MODEL` are both set. Its output is validated before it is sent.
