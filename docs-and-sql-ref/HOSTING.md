# Hosting: Vercel, the WhatsApp host, and Supabase

Status: 16 Oct 2026. Each item says what was verified here and what needs your accounts.

## 1. Where each part runs

| Part | Runs on | Why |
|---|---|---|
| Web app (pages, actions, route handlers) | **Vercel** (Pro plan) | Serverless, builds from `vercel.json` |
| Daily and per-minute checks, digests, escalations | **Vercel Cron** → `GET /api/cron/tick`, every minute | Pro plan allows per-minute schedules; Hobby allows one run a day |
| WhatsApp Web session (pilot) | **Always-on host you control** running `apps/whatsapp-web` | It keeps a Chromium session open, which Vercel cannot do |
| WhatsApp Cloud API webhook (production, later) | **Vercel** `/api/whatsapp/webhook` | Meta calls it over HTTPS |
| Database, auth, file storage | **Supabase** | Postgres with row-level security, Auth, Storage |
| CAD translation and viewer | **Autodesk Platform Services** | Called from Vercel and the browser |

Nothing else is needed. Hostinger, Docker and Netlify are not used.

## 2. Vercel

1. Import the repository (`hrdikpande/arch-flow`, branch `main`).
2. `vercel.json` sets the build and the cron. Do not override them.
3. Add the variables from `.env.example` under the groups `[ALL]`, `[VERCEL]`, `[CLOUD]` (if used),
   `[APS]` and `[GEMINI]` (if used). Do not add the `[WA-HOST]` variables to Vercel: the session key
   belongs only on the host.
4. Set `MESSAGING_TRANSPORT=web` for the pilot.
5. Deploy. Then check `https://<domain>/api/health`. It returns JSON with `database`, `whatsapp`,
   `gemini` and `autodesk` status, and never a secret value.

Cron: `vercel.json` schedules `GET /api/cron/tick` every minute (`* * * * *`). Vercel sends
`Authorization: Bearer $CRON_SECRET`. A request without the right secret gets 401.

**Verified here:** the cron route runs against a real Postgres database through the local Supabase
gateway. Repeated calls per minute did not duplicate the digest (VERIFICATION.md section 9).

**Not verified:** Vercel itself. This environment cannot reach Vercel. The per-minute schedule takes effect only after a
deploy on a Pro plan, and the first real run should be checked in the Vercel dashboard (Cron Jobs tab).

## 3. The WhatsApp host (pilot)

Requirements: Node.js 22.19 or newer, Chromium or Chrome, a network path to `web.whatsapp.com`, and
the machine kept awake and on the network.

```bash
git clone https://github.com/hrdikpande/arch-flow.git && cd arch-flow
npm ci
cp .env.example .env        # fill the [ALL] and [WA-HOST] groups
npm start -w @arch-flow/whatsapp-web      # first run prints the QR code
```

Keep it running with pm2 (restarts after crashes and disconnects):

```bash
npm i -g pm2
pm2 start apps/whatsapp-web/ecosystem.config.cjs
pm2 logs arch-flow-whatsapp-web
pm2 save && pm2 startup     # run the printed command once, so it starts after a reboot
```

Variables on the host: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WA_SESSION_KEY`, `APP_URL`,
optional `WA_CHROMIUM_PATH`, `WA_FLUSH_SECONDS`, `WA_SESSION_NAME`. The service role key is powerful:
keep it only in the host's `.env` (file permission 600) and in Vercel's server-side variables.

Restart behaviour: a disconnect makes the process exit with code 1. pm2 waits 15 seconds and restarts it.
`max_restarts: 50` caps a crash loop, after which pm2 stops and the admin page shows **Not reporting**.

**Verified here:** the real `whatsapp-web.js` starts a real Chromium and tries to reach
`web.whatsapp.com`. The connection is refused by this environment's network policy, so the process exits
cleanly with an error. The QR code and the linked session are **not verified** (see VERIFICATION.md
section 9).

## 4. Supabase

1. Create or share the project. Copy the URL and keys from Project Settings → API into `.env` and
   Vercel. Never into the repository.
2. Apply the migrations in order: `supabase db push` (or the SQL editor, in the file order under
   `supabase/migrations`). The last one adds `whatsapp_sessions` and enables the 13 alert events.
3. Create the storage buckets `drawings` and `imports` (private).
4. Auth: email and password, and magic links for invitations and password reset. Set the site URL to
   `APP_URL`.
5. Row-level security is on for every table. The web app and the host use the service role on the
   server only. Browser code uses the anon key and the user's session.

**Verified here:** every migration applies to PostgreSQL 16, and the RLS suite passes
(`supabase/tests/run_rls_tests.sh`). The API layer is verified with PostgREST, the same REST service
Supabase uses. Supabase's own Auth and Storage services were replaced by a local stub for testing.

**Not verified:** a real Supabase project (no project link yet).

## 5. Autodesk Platform Services

Variables: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_BUCKET_KEY`, and `NEXT_PUBLIC_APS_VIEWER_API`
(`streamingV2` for US data, `streamingV2_EU` for EMEA data).

Flow: the browser uploads to a signed S3 URL, the server completes the upload, starts an SVF2
translation (2D and 3D), and polls the manifest. The viewer gets a read-only token from
`/api/aps/viewer-token`, which checks access first.

- Retry: a failed translation can be retried up to three times (`translation_attempts`). The retry
  sends `x-ads-force`, which deletes the old derivatives. The header is sent only on retries.
- Clients view CAD only when their organisation allows it (`allow_aps_processing`, the NDA flag). Native
  download needs `allow_native_download`.

**Verified here:** the request shapes match Autodesk's published reference for the signed upload
(`GET .../signeds3upload?parts=`, `POST .../signeds3upload` with `uploadKey`), the translation job (SVF2
output with 2D and 3D views), and the viewer initialiser (`AutodeskProduction2`, `streamingV2`). Unit tests
cover these shapes (13 web tests).

**Not verified:** any call to Autodesk. This environment cannot reach `developer.api.autodesk.com`. The
viewer script path (`viewers/7.*`) has not been loaded in a browser.

## 6. Network access this environment needs for live checks

These hosts are refused by the environment's network policy, so the live checks above could not run:

- `web.whatsapp.com` (QR login and WhatsApp Web)
- `graph.facebook.com` (WhatsApp Cloud API)
- `developer.api.autodesk.com` (Autodesk), and `cdn.jsdelivr.net` if a CDN script is used
- your Supabase project host (`*.supabase.co`)
- `vercel.com` (deploy checks)

## 7. Running the tests locally

| Command | What it checks |
|---|---|
| `npm test` | Domain (67), messaging (35 + integration when configured), WhatsApp Web helpers (crypto, store) |
| `npm run typecheck` | All workspaces |
| `npm run build` | The production build |
| `npm run e2e -w @arch-flow/web` | 11 smoke tests on the built app (no login needed) |
| `supabase/tests/run_rls_tests.sh` | Row-level security on PostgreSQL 16 |
| `POSTGREST_BIN=/path/to/postgrest bash supabase/tests/api/run.sh` | The full local stack: migrations, PostgREST, the Supabase gateway stub, the messaging pipeline, the WhatsApp Web wiring, the cron route and the signed-in browser tests |

`supabase/tests/api/run.sh` needs PostgreSQL 16, the PostgREST binary (GitHub releases), Node 22 and
Chromium for Playwright. It does not need any real account or key.
