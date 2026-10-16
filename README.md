# arch-flow

Drawing control and WhatsApp alerts for design and engineering firms. LatentIQ builds and runs it.

- **Web app:** Next.js 15 (App Router), React 19, Tailwind v4, Supabase (Postgres, Auth, Storage).
- **Alerts (pilot):** WhatsApp Web session process (`apps/whatsapp-web/src/WhatsAppWeb.js`), logged in by QR code on a dedicated test number. Owner and allowlisted numbers only.
- **Alerts (production, clients):** WhatsApp Cloud API (Meta), through Vercel routes. Clients never receive WhatsApp.

Read these next: **docs-and-sql-ref/WHATSAPP.md** (how WhatsApp works, QR login, commands), **HOSTING.md** (Vercel, the WhatsApp host, Supabase, Autodesk), **ARCHITECTURE.md**, **VERIFICATION.md** (what was tested, and what was not).
- **CAD viewing:** Autodesk Platform Services (APS) translates DWG, RVT, IFC and NWD. PDFs are viewed directly.
- **Digest wording:** Gemini, optional. Every number in its output is checked against the source data. If the check fails, the deterministic text is sent.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Web app, API routes, Vercel cron and WhatsApp webhook, Playwright tests |
| `packages/domain` | Business rules (lifecycle, SLA, naming, revisions, clash and register import, critical rules). Pure TypeScript, unit tested. |
| `apps/whatsapp-web` | `src/WhatsAppWeb.js`: the WhatsApp Web session process (always-on host). Encrypted session in Supabase. `ecosystem.config.cjs` for pm2. |
| `packages/messaging` | Outbox, fan-out, inbound commands, digest, escalations, RFI and stale-revision checks, Cloud API transport, webhook verification |
| `supabase/migrations` | Schema, read policies (RLS) and feature tables |
| `supabase/tests` | Row-level security suite (PostgreSQL 16) and `api/run.sh`, the local stack: PostgREST, a Supabase gateway stub, seeds, and the integration and browser tests |
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
3. Set `MESSAGING_TRANSPORT=web` (pilot) and deploy. The cron runs `GET /api/cron/tick` every minute. It creates digests, alerts and escalations, and never duplicates a digest. Details: HOSTING.md.
4. In Meta, set the webhook callback URL to `https://<your-domain>/api/whatsapp/webhook` with `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages`.
5. Check `https://<your-domain>/api/health`. It reports which integrations are configured. It never returns secret values.

**Vercel Pro is required** for the per-minute cron (Hobby allows one run a day). Retries after a failed send wait 1, 5 and 30 minutes.

**Production messages outside the 24-hour window** must use an approved template (`WHATSAPP_TEMPLATE_NAME`). Meta has to approve it first. Until then, messages to recipients who have not written to the number in the last 24 hours will fail.

## WhatsApp (pilot) in short

`WhatsAppWeb.js` runs on an always-on host, not on Vercel. Start it with `npm start -w @arch-flow/whatsapp-web`, scan the QR code once on the dedicated test number, and keep it running with pm2. Full steps and the list of current behaviour: **docs-and-sql-ref/WHATSAPP.md**.

## Testing

| Command | What it checks |
|---|---|
| `npm test` | Domain (67), messaging (35), WhatsApp Web helpers (5) |
| `npm run typecheck` | All workspaces |
| `npm run build` | Production build |
| `npm run e2e -w @arch-flow/web` | 11 smoke tests on the built app |
| `supabase/tests/run_rls_tests.sh` | Row-level security on PostgreSQL 16 |
| `POSTGREST_BIN=/path/postgrest bash supabase/tests/api/run.sh` | Full local stack: migrations, PostgREST, Supabase gateway stub, messaging pipeline, WhatsApp Web wiring, cron route, signed-in browser tests |

Results and the list of what is **not** verified (live WhatsApp, Autodesk, Vercel, a real Supabase project):
docs-and-sql-ref/VERIFICATION.md, section 9.

## Status

See `docs-and-sql-ref/FEATURES.md` (top section) for per-feature status and VERIFICATION.md section 9 for what was run. Verified on a real database through the local stack: the messaging pipeline, the WhatsApp Web wiring, the cron route, the RLS policies and the signed-in pages for the owner and a client. Not verified here: the QR login and real WhatsApp traffic, Autodesk, Vercel deployment, and a real Supabase project (see section 9.4).

## Open items before go-live

- Supabase project: share the project link; keys go into Vercel and the host's `.env`, never into this repository. Run the migrations on that project (`supabase db push`).
- Autodesk API credentials into `.env` (`APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_BUCKET_KEY`).
- Host for `WhatsAppWeb.js` (an always-on machine) and a QR scan on the dedicated test number.
- Meta Cloud API credentials and an approved utility template, for client-facing messages later.
- Holiday list and weekend pattern for working-day SLAs (currently Monday to Friday).
- Autodesk pricing, NWD support and whether the NDA allows cloud conversion for clients.
