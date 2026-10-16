# WhatsApp: how it works today (pilot and production)

Status: 16 Oct 2026. Verified items are marked. Items marked **not verified** need a real WhatsApp
account or a network path that this environment does not have. See VERIFICATION.md section 9.

## 1. Two channels, two jobs

| Channel | Who it is for | How it sends | Where it runs |
|---|---|---|---|
| **WhatsApp Web (pilot)** | The owner and up to 4 internal people, on a dedicated test number | `whatsapp-web.js` session, logged in by QR code | `apps/whatsapp-web/src/WhatsAppWeb.js` on an always-on host (your PC, mini-PC or VM) |
| **WhatsApp Cloud API (production)** | Anything client-facing, later | Meta Graph API, approved templates outside the 24-hour window | Vercel routes (`/api/whatsapp/webhook`, `/api/cron/tick`) |

Clients never receive WhatsApp in the pilot. The admin cannot add a client user as a recipient (WA-15,
enforced in `apps/web/src/app/actions/admin.ts`).

`MESSAGING_TRANSPORT` picks who sends:

- `web`: the WhatsApp Web host sends. Vercel creates messages and does not send them.
- `cloud`: Vercel sends through the Cloud API.
- unset: nothing is sent. Events are still recorded.

Vercel cannot hold a WhatsApp Web session (it has no long-running Chromium), so the pilot always
needs the host.

## 2. Login by QR code (pilot)

1. Set `.env` on the host (see `.env.example`, section `[WA-HOST]`). `WA_SESSION_KEY` is required.
2. Start the process: `npm ci` then `npm start -w @arch-flow/whatsapp-web`, or
   `pm2 start apps/whatsapp-web/ecosystem.config.cjs` to keep it running.
3. The terminal prints a QR code (`qrcode-terminal`), with the line
   "Scan this QR code with the test number".
4. On the **dedicated test number's phone**: WhatsApp → Settings → Linked devices → Link a device →
   scan the code.
5. The process logs `Session authenticated`, then `Encrypted session saved`, then `WhatsApp connected`.
   The session is stored encrypted (AES-256-GCM) in Supabase, table `whatsapp_sessions`. The key is
   `WA_SESSION_KEY` on the host. Supabase cannot read the session without it.
6. From then on, a restart reconnects without a QR code. The admin WhatsApp page shows
   **Linked and sending** with the last report time.

Re-linking happens when the phone unlinks the device, or the session is invalid:

- The process logs `Authentication failed` (auth_failure) or `Disconnected` and exits with code 1.
  pm2 restarts it. If the session is no longer valid, the QR code is printed again.
- To force a fresh link, delete the stored row (`delete from whatsapp_sessions where id = 'arch-flow-pilot';`)
  and restart the process. Then scan again.

Losing `WA_SESSION_KEY` makes the stored session unreadable. The same fix applies: delete the row, scan again.

## 3. Who receives messages

Table `whatsapp_recipients`. A person receives messages only when all of these hold:

- their user account exists and is not a client user (WA-15);
- `active = true`;
- `opted_in = true` and `opt_in_confirmed_at` is set. The admin records the written opt-in on the
  admin WhatsApp page ("Record written opt-in"). Without it, nothing is sent (WA-03);
- `opted_out_at` is empty (STOP sets it).

The group is limited to 5 people: the owner and up to 4 internal people (WA-01).

## 4. What gets sent

### 4.1 Event alerts (13 event types, all on by default)

Set on the admin WhatsApp page, stored in `whatsapp_event_settings`. Upload and decision events are on
(confirmed 16 Oct 2026):

| Event | Message text (summary) |
|---|---|
| `file.uploaded` | Upload: file name, by whom, time IST, link |
| `approval.requested` | Approval requested, link |
| `approval.escalated` | Approval escalated to owner (kind `escalation`) |
| `approval.approved` | Decision: approved |
| `approval.rejected` | Decision: rejected, with reason |
| `conflict.raised` | Client conflict raised (notice only, no client content) |
| `conflict.responded` | Decision: conflict answered |
| `conflict.overdue` | Client conflict overdue |
| `transmittal.sent` | Decision: transmittal sent |
| `revision.issued` | Issued: sheet, revision, title, project, superseded revision, link |
| `clash.opened` | Critical clash opened |
| `rfi.overdue` | RFI overdue |
| `sheet.stale_revision` | Stale revision flag |

Every event goes to every opted-in recipient once (dedupe key: event id plus recipient). No files are
attached, only links (WA-16). There are no quiet hours (WA-14).

### 4.2 Morning digest

- Created once per recipient per day at `digest.time_local` (default `09:00`, IST). The dedupe key
  includes the date, so the cron can run every minute without sending twice. **Verified** against the
  database: three runs in a row produced one digest.
- Sections: what happened since the last digest, what is waiting for you, overdue items, open critical
  clashes, overdue client conflicts, and a dashboard link.
- Text is deterministic. Optional Gemini paragraphs are checked against the source numbers. If any
  number does not match, the deterministic text is sent instead (DIG-05).
- Length limit about 1,500 characters (DIG-08).

### 4.3 Escalations and checks

- Approvals pending for `approval.escalation_days` working days (default 2) notify the owner.
- The daily check creates `rfi.overdue` and `sheet.stale_revision` events. The conflict check creates
  `conflict.overdue`. Each check runs in the cron pass, so it is safe to run every minute.

## 5. Owner commands (inbound)

Only numbers in `whatsapp_recipients` (allowlisted and opted in) get an answer. Any other number is
logged with `is_allowed = false` and gets no reply. Messages from groups, and messages the process sent
itself, are ignored.

| Message | Reply |
|---|---|
| `today` | Today's answer from the database, limited to the projects the sender can see |
| `overdue` | Overdue sheets, RFIs and reviews |
| `critical` | Open critical clashes and RFIs |
| `digest` | The digest now. At most once per 10 minutes per number |
| `help` | The command list. Any unknown text also gets this |
| `STOP` | Confirms and turns alerts off for this number |
| `START` | Turns alerts back on, only if the admin has confirmed the written opt-in |

Commands are matched case-insensitively after trimming spaces. Replies are built from fixed queries,
not from free text, so a message cannot make the system run arbitrary queries.

A reply to a message the person sent is allowed even right after STOP, so the STOP confirmation itself
arrives. Alerts and digests stay blocked after STOP.

## 6. Limits, retries and duplicates

| Rule | Value | Where |
|---|---|---|
| Messages per recipient per day | 30 (`whatsapp.daily_cap`). Above that, messages wait for the next digest, which says what was held | `supabase-adapter.ts`, `decideSend` |
| Pacing | At most 3 messages per recipient per minute. Extra messages wait, they are not lost | `decideSend` |
| Same event to the same recipient | Sent once. A repeat within 5 minutes is cancelled | dedupe key and `decideSend` |
| Retries | Failed send retried after 1, 5 and 30 minutes, then marked failed (4 attempts) | `nextAttemptAfterFailure` |
| Connection down | Messages wait in the outbox and send when the host reconnects | `decideSend` (`wait`) |

## 7. What the host does every few seconds

`WhatsAppWeb.js` runs two timers:

- every `WA_FLUSH_SECONDS` (default 15): fan out new events to recipients, then send queued messages
  (`runtime.flush()`);
- every 60 seconds: write a heartbeat to `settings` key `runtime.heartbeat` (connected or not, last
  time). The admin page reads it. If the heartbeat is older than 3 minutes, the page shows
  **Not reporting**.

Inbound messages arrive as events from the WhatsApp Web client and are handled immediately.

## 8. Production: Cloud API (client-facing, later)

- `MESSAGING_TRANSPORT=cloud`, plus the `WHATSAPP_*` variables in `.env.example`.
- Meta sends inbound messages and delivery receipts to `https://<domain>/api/whatsapp/webhook`. The
  signature is checked with `WHATSAPP_APP_SECRET`. The handshake uses `WHATSAPP_VERIFY_TOKEN`.
- Outside the 24-hour customer window, only an approved template is sent (`WHATSAPP_TEMPLATE_NAME`,
  for example `arch_flow_update`). Meta must approve it first.
- The Vercel cron sends queued messages for this mode.

**Not verified:** Cloud API sends and the webhook with real Meta traffic. The webhook signature and
handshake are verified locally (Playwright, 11 smoke tests).

## 9. Data and audit

| Table | Holds |
|---|---|
| `whatsapp_recipients` | Who receives messages, opt-in and opt-out |
| `whatsapp_event_settings` | Which event types send |
| `whatsapp_outbox` | Every message: status, attempts, Meta or WhatsApp message id, body preview |
| `whatsapp_inbound` | Every inbound message, allowed or not, with the command |
| `digests` | Each digest, once per recipient per day |
| `whatsapp_sessions` | The encrypted WhatsApp Web session. No policies, so only the service role can read it |
| `settings` | `runtime.heartbeat`, `digest.time_local`, `whatsapp.daily_cap`, `approval.escalation_days` |

Message bodies are stored in `whatsapp_outbox.body_preview` and `whatsapp_inbound.body` for audit. The host
log records counts and status only, not message text or phone numbers.

## 10. Risk, decided for the pilot

WhatsApp Web (`whatsapp-web.js`) is an unofficial client. WhatsApp can restrict or ban the number. The
pilot uses only a dedicated test number, owner and internal allowlisted people, and no client data.
The risk must be accepted in writing before the pilot starts (open item).

## 11. Operating checklist

- [ ] `WA_SESSION_KEY` generated and stored on the host and in the password manager.
- [ ] Host machine stays on. `pm2 startup` and `pm2 save` run once, so it survives reboots.
- [ ] Test number linked by QR. Admin page shows **Linked and sending**.
- [ ] Owner's opt-in recorded on the admin page. `START` tested from the owner's phone.
- [ ] `MESSAGING_TRANSPORT=web` set on Vercel.
- [ ] Written acceptance of the ban risk on file.
