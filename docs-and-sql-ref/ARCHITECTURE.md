# Architecture (current, 16 Oct 2026)

This describes the system as built. Older design notes (worker, Netlify, Hostinger) are removed.
Deployment and WhatsApp details: HOSTING.md and WHATSAPP.md.

## 1. Components

```
                       ┌────────────────────────────── Vercel (Pro) ──────────────────────────────┐
  Browser ───────────► │ Next.js 15 app: pages, server actions, route handlers                     │
  (firm users,         │   /api/cron/tick   (every minute: checks, digests, escalations, outbox)   │
   clients)            │   /api/whatsapp/webhook (Cloud API, later)   /api/health                  │
                       │   /api/aps/viewer-token   /api/reports/[report]                           │
                       └──────────┬───────────────────────────────┬─────────────────┬─────────────┘
                                  │ service role (server only)    │ user session    │ APS (server)
                                  ▼                               ▼                 ▼
                       ┌──────────────────────┐        ┌──────────────────┐  ┌─────────────────────┐
                       │ Supabase             │        │ Autodesk APS     │  │ Meta Cloud API      │
                       │ Postgres (RLS)       │        │ OSS, Model Deriv.│  │ (production, later) │
                       │ Auth, Storage        │        │ Viewer SDK       │  └─────────────────────┘
                       └──────────┬───────────┘        └──────────────────┘
                                  │ service role                     ▲
                       ┌──────────┴────────────────────────────────────────────┐
                       │ WhatsApp Web host (always on): apps/whatsapp-web      │
                       │  WhatsAppWeb.js: QR login, inbound commands,          │
                       │  outbox sender (every 15 s), heartbeat (every 60 s)   │
                       └───────────────────────────────────────────────────────┘
```

| Package | Role |
|---|---|
| `apps/web` | Next.js app. Pages for firm users (`(app)`), client portal (`portal`), route handlers, server actions |
| `apps/whatsapp-web` | The WhatsApp Web session process (pilot). Plain Node.js, `whatsapp-web.js` |
| `packages/domain` | Business rules, pure TypeScript: lifecycle, SLA working days, naming, revisions, register and clash import validation, critical rules |
| `packages/messaging` | Outbox, fan-out, inbound commands, digests, escalations, checks, Cloud transport, webhook verification, runtime |
| `supabase/migrations` | Schema, read policies, feature tables, WhatsApp session table, alert defaults |
| `supabase/tests` | RLS suite (PostgreSQL 16) and the API harness (PostgREST + Supabase gateway stub + tests) |

## 2. Data flow for an alert

1. A business action (upload, approval, conflict, transmittal, issue) writes its row and an `events` row
   (`recordEvent` in `apps/web/src/lib/events.ts`). In web mode this also calls `after()` to fan out
   immediately.
2. Fan-out (`fanoutOnce`) reads new events after a stored cursor. For each enabled alert type, it creates
   one `whatsapp_outbox` row per opted-in recipient (unique dedupe key).
3. The sender (the WhatsApp Web host in pilot mode, or Vercel in cloud mode) takes queued rows that are
   due, asks `decideSend` (opt-in, enabled event, connection, daily cap, pacing, duplicates), then sends.
   Failures retry after 1, 5 and 30 minutes.
4. The result (`sent`, `wa_message_id`, attempts) is written back to the outbox.

In web mode, Vercel runs steps 1, 2 and the daily items (digests, escalations, RFI and revision checks),
and never sends (`sendFromThisProcess: false`). The host runs steps 2 and 3. This split keeps one sender,
so nothing is sent twice.

## 3. Inbound commands

The host receives a message, drops groups and its own messages, and calls
`runtime.handleInboundMessage`. `handleInbound` checks the allowlist (`whatsapp_recipients`), logs every
message in `whatsapp_inbound` (allowed or not), and queues a reply for allowed numbers. STOP and START
change the opt-in. Replies to the person are allowed even after STOP. Alerts are not.

## 4. Access control

- Every table has row-level security. Policies are written in `20261016000100_read_policies.sql` and
  `20261016000300_rls_complete.sql`. End users have no write policies. Writes go through server actions,
  which check roles in code and use the service role.
- `whatsapp_sessions` has RLS on and no policies, and `anon` and `authenticated` have no privileges on it.
- Clients see issued and superseded revisions of their own organisation's projects only. CAD viewing needs
  the organisation's NDA flag. The viewer token route repeats these checks (`/api/aps/viewer-token`).
- Client users cannot be WhatsApp recipients (WA-15).
- Cron and webhook routes check their own secret or signature. The middleware lets those routes through
  and returns 401 JSON for other unauthenticated API calls.

## 5. Drawings and CAD

- PDF: stored in Supabase Storage (`drawings`, private). Viewed through a 5-minute signed link in an
  iframe. Download needs the organisation's download flag.
- CAD (DWG, RVT, IFC, NWD): uploaded to APS (signed S3 URL, parts), translated to SVF2, viewed with the
  Autodesk Viewer SDK. Status: not sent, uploading, translating, ready, failed. A failed translation can
  be retried three times.
- One component renders a drawing for every role: `components/viewer/DrawingView.tsx`. Access rules are in
  `lib/drawing-view.ts`. The clash detail page uses the same component for each linked sheet.

## 6. Reports

`/api/reports/[report]`: register (PDF, Excel), issues, transmittals, changes (Excel with totals), and the
owner dashboard (PDF). Internal users only.

## 7. Scheduling

| Job | When | Where |
|---|---|---|
| Event fan-out and outbox send | Every 15 s (host), after each event (web) | Host, `runtime.flush()` |
| Checks (RFI overdue, stale revision, conflicts), digests, escalations | Every minute | Vercel cron, `runtime.tick()` |
| Heartbeat | Every 60 s | Host, `settings.runtime.heartbeat` |

Each daily item is created once per day through its dedupe key, so the frequent schedule is safe.

## 8. Failure behaviour

| Failure | What happens |
|---|---|
| Host offline | Messages queue. The admin page shows **Not reporting** after 3 minutes. Vercel keeps creating messages. |
| WhatsApp disconnect | The process exits with code 1. pm2 restarts it. Messages wait meanwhile. |
| Session invalid | The process logs authentication failure and exits. Delete the stored row and scan again. |
| Gemini output fails the number check | The deterministic digest text is sent. |
| Send error | Retry after 1, 5 and 30 minutes, then marked failed. |
| Autodesk unavailable | The file shows failed with the error. Retry is available up to three times. |

## 9. Verification

See VERIFICATION.md. Automated suites cover the domain rules, the messaging pipeline against a real
database, the WhatsApp Web wiring, the cron route, row-level security and the signed-in pages. Live
WhatsApp, Autodesk and Vercel behaviour is not verified here.

## 10. Data residency and third parties

| Data | Where it goes | Who controls it | Status |
|---|---|---|---|
| Firm and project records, users, audit | Supabase Postgres (region open, O-A4) | Firm, via the Supabase project | Region not chosen. Decide before the pilot. |
| Drawings (PDF) | Supabase Storage, private bucket, signed links (5 minutes) | Firm | In use |
| CAD files (DWG, RVT, IFC, NWD) | Uploaded to Autodesk (APS) for translation and viewing | Autodesk terms and the NDA flag | Owner confirmed NWD cloud conversion is allowed. Scope for firm files (not only client files) to confirm. |
| WhatsApp messages (pilot) | WhatsApp Web servers (through the host) | WhatsApp | Accepted risk, written acceptance open |
| WhatsApp messages (production) | Meta Cloud API | Meta | Not live |
| Digest wording (optional) | Google Gemini API | Google, only when enabled | Off until the owner decides which data may leave the firm |
| WhatsApp session | Encrypted in Supabase, key on the host only | Firm, host operator | In use |
| Hosting of the web app | Vercel (Pro). Region setting to confirm. | Vercel | Region not chosen |
| Logs | Host and Vercel logs hold counts and status, not message text or drawings | Firm | In use |

**Rules in the code:** the service role is used only on the server and on the host; nothing with the service role is in browser code. Secrets come from environment variables only. Client users never see WhatsApp settings or internal data (RLS tests).

## 11. Changes since the first version (16 Oct 2026)

- Netlify and Hostinger removed. Vercel Pro hosts the web app and runs the checks every minute.
- The long-running worker became two parts: the messaging runtime (inside the web app) and the WhatsApp host (`apps/whatsapp-web`).
- WhatsApp has two channels: QR-linked pilot on the host, and Cloud API for production.
- Translation retry, and the `x-ads-force` header used only on retry.
- One drawing viewer for internal users and clients, behind one set of access rules.
- Full list: VERIFICATION.md section 10.

