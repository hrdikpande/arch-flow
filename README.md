# arch-flow

Drawing control and WhatsApp alerts for design and engineering firms. LatentIQ builds and runs it.

- **Web app:** Next.js 15 (App Router), React 19, Tailwind v4, Supabase (Postgres, Auth, Storage).
- **Alerts:** WhatsApp Cloud API (Meta). Messages run from Vercel routes and Vercel Cron. No always-on worker.
- **CAD viewing:** Autodesk Platform Services (APS) translates DWG, RVT, IFC and NWD. PDFs are viewed directly.
- **Digest wording:** Gemini, optional. Every number in its output is checked against the source data. If the check fails, the deterministic text is sent.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Web app, API routes, Vercel cron and WhatsApp webhook, Playwright tests |
| `packages/domain` | Business rules (lifecycle, SLA, naming, revisions, clash and register import, critical rules). Pure TypeScript, unit tested. |
| `packages/messaging` | Outbox, fan-out, inbound commands, digest, escalations, RFI and stale-revision checks, Cloud API transport, webhook verification |
| `supabase/migrations` | Schema, read policies (RLS) and feature tables |
| `supabase/tests` | Row-level security test suite (runs on PostgreSQL 16) |
| `docs-and-sql-ref` | PRD, features, architecture, schema, verification log |
| `vercel.json` | Build settings and the daily cron |
| `.env.example` | Every environment variable the app reads. Copy to `.env` locally, or add the same names in Vercel. |

## Setup

Requires Node 22.19 or newer.

```bash
npm ci
cp .env.example .env        # then fill in your own values; never commit .env
npm run typecheck
npm test                    # domain (67), messaging (35), web (12)
npm run build
npm run e2e -w @arch-flow/web   # Playwright, needs a built app (see below)
```

Build without real credentials (used in CI):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon \
SUPABASE_SERVICE_ROLE_KEY=placeholder-service \
APP_URL=https://arch-flow.example npm run build
```

## Environment variables

All secrets live in environment variables. None are stored in code, the database or the repository. `.env.example` lists them all.

| Group | Variables |
|---|---|
| App | `APP_URL`, `UPLOAD_MAX_MB` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| WhatsApp Cloud API | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` |
| Cron | `CRON_SECRET` |
| Gemini (optional) | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Autodesk APS | `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_BUCKET_KEY`, `APS_REGION`, `APS_VIEWER_VERSION` |

`NEXT_PUBLIC_*` values are visible in the browser by design. Keep the service role key, WhatsApp access token, app secret, Gemini key and APS secret server-side only.

## Deployment on Vercel

1. Import the repository in Vercel. `vercel.json` sets the build command and the output directory (`apps/web/.next`).
2. Add every variable from `.env.example` under Project → Settings → Environment Variables.
3. Deploy. The cron runs `GET /api/cron/tick` once a day at 03:30 UTC (09:00 IST) and sends `Authorization: Bearer $CRON_SECRET`.
4. In Meta, set the webhook callback URL to `https://<your-domain>/api/whatsapp/webhook` with `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages`.
5. Check `https://<your-domain>/api/health`. It reports which integrations are configured. It never returns secret values.

**Vercel Hobby limits cron jobs to once a day.** Retries after a failed send wait 1, 5 and 30 minutes, so they need a per-minute schedule. That needs the Pro plan. On Hobby, failed messages wait for the next daily pass.

**Production messages outside the 24-hour window** must use an approved template (`WHATSAPP_TEMPLATE_NAME`). Meta has to approve it first. Until then, messages to recipients who have not written to the number in the last 24 hours will fail.

## Testing

| Suite | Command | Result (16 Oct 2026) |
|---|---|---|
| Domain unit tests | `npm test -w @arch-flow/domain` | 67 passed |
| Messaging unit tests | `npm test -w @arch-flow/messaging` | 35 passed |
| Web unit tests | `npm test -w @arch-flow/web` | 12 passed |
| Row-level security (PostgreSQL 16) | `supabase/tests/run_rls_tests.sh` | 31 checks passed |
| Playwright smoke tests | `npm run e2e -w @arch-flow/web` | 10 passed |

Playwright covers the unauthenticated redirect, login and password reset pages, the health endpoint, the WhatsApp handshake (valid and invalid token), webhook signature checks, and cron authentication. Screenshots are written to `apps/web/test-results/`.

**Not yet tested against live services:** signed-in workflows (they need a Supabase project with users), real WhatsApp delivery, Gemini output, and Autodesk translation. These are listed in `docs-and-sql-ref/VERIFICATION.md`.

## Status

See `docs-and-sql-ref/FEATURES.md` (top section) for per-feature status. In short: all P0 and P1 screens exist and compile. Live end-to-end runs are pending the items below.

## Open items before go-live

- Supabase staging project URL and keys added to Vercel (not to this repository).
- Meta test number, WhatsApp Cloud API credentials and an approved utility template.
- Vercel plan choice for per-minute retries (Hobby is daily only).
- Clash export sample, to confirm the import column names.
- Holiday list and weekend pattern for working-day SLAs (currently Monday to Friday).
- Autodesk pricing, NWD support and whether the NDA allows cloud conversion for clients.
