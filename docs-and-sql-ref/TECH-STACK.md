# Tech Stack — Drawing Control & Alerts

**Status:** Draft for approval
**Version rule:** every package version below is a **starting point copied from the reference or chosen for compatibility**. Verify the current stable version at the start of Phase 0 and pin it exactly. Nothing here has been installed or tested in this project yet.

**Status key**
- **DECIDED**: agreed in our discussion
- **REFERENCE**: taken from the uploaded design-system export
- **PROPOSED**: my recommendation, for your approval
- **OPEN**: needs your decision

---

## 1. Summary

| Layer | Choice | Status |
|---|---|---|
| Web app | Angular 20 + PrimeNG + Tailwind CSS v4 | REFERENCE, framework choice OPEN (O-T1) |
| Client portal | Same Angular app, separate route area | PROPOSED |
| API | Netlify Functions, Node 22 LTS, TypeScript | DECIDED (Netlify), runtime PROPOSED |
| Database, auth, files | Supabase: Postgres 15+, Auth, Storage (India region) | DECIDED |
| WhatsApp worker | Node 22 LTS, whatsapp-web.js, Docker on Hostinger VPS | DECIDED (pilot) |
| WhatsApp production | Meta WhatsApp Cloud API | DECIDED (production) |
| AI text | Gemini API, server-side only, digest text only | DECIDED |
| Drawing viewing | Autodesk Platform Services (Model Derivative, Viewer SDK) | DECIDED |
| PDF viewing | PDF.js | PROPOSED |
| Hosting | Netlify (app, functions), Supabase (data), Hostinger (worker) | DECIDED |
| Testing | Playwright (E2E), unit and integration tests per layer | REFERENCE (E2E), rest PROPOSED |

---

## 2. Frontend

| Package / tool | Version (verify at Phase 0) | Use | Status |
|---|---|---|---|
| Angular (standalone components, signals, control flow) | 20.x — reference used 20.3.x | Application framework | REFERENCE / O-T1 |
| `@angular/*` packages | **One exact version for all** — reference mixed two patch versions and needed `--legacy-peer-deps` | Framework packages | REFERENCE (fix) |
| PrimeNG | ^20.4.0 (matches Angular 20) | Table, dialog, select, toast, tabs, inputs | REFERENCE |
| `@primeuix/themes` (Aura preset) | ^2.0.2 | PrimeNG theme, sage preset | REFERENCE |
| PrimeIcons | ^7.0.0 | Icons (`pi-*`) | REFERENCE |
| Tailwind CSS | ^4.1.18, CSS-first `@theme` | Utility classes, token aliases | REFERENCE |
| `@tailwindcss/postcss`, `autoprefixer`, `postcss` | Match Tailwind v4 | Build | REFERENCE |
| `tailwindcss-primeui` | ^0.6.1 | Tailwind ↔ PrimeNG bridge | REFERENCE |
| `tw-animate-css` | ^1.4.0 | Optional animation utilities | REFERENCE (optional) |
| `@angular/animations` | Same as Angular | Route and list animations, with reduced-motion switch | REFERENCE |
| PDF.js (`pdfjs-dist`) | Verify at build | In-browser PDF viewing | PROPOSED |
| Autodesk Viewer SDK | Current release at build; loaded from Autodesk's distribution | DWG, RVT, IFC, NWD viewing | DECIDED (service), version PROPOSED |
| Chart.js via `primeng/chart` | ^4.5 | Dashboard charts | OPTIONAL (Q-P7) |
| `@supabase/supabase-js` | v2, verify at build | Auth, storage uploads, realtime | PROPOSED |
| `tus-js-client` | Verify at build | Resumable uploads to Supabase Storage | PROPOSED |
| `@sentry/angular` | ^10 | Error tracking | OPTIONAL (O-A8) |
| `@ngx-translate/*` | — | **Not used.** English only (decision 43) | REMOVED |
| `quill` | — | **Not used.** Conflict content is plain text | REMOVED |
| `@angular/service-worker` (PWA) | — | **Not used.** Not in scope | REMOVED |
| Stripe, cart, shop packages | — | **Not used.** Not in scope | REMOVED |

**Testing (frontend)**

| Tool | Use | Status |
|---|---|---|
| Playwright | End-to-end tests of the main journeys, Chromium | REFERENCE (also used by the reference app) |
| Karma and Jasmine | Unit tests, as in the reference | REFERENCE / O-T2 |
| Vitest | Alternative unit runner | O-T2 (choose one runner) |
| axe-core (via Playwright) | Automated accessibility checks | PROPOSED |

**Frontend budgets** (from reference, keep): initial bundle warn 1 MB, error 2 MB; per-component styles warn 8 kB, error 16 kB.

---

## 3. API layer (Netlify Functions)

| Item | Choice | Status |
|---|---|---|
| Hosting | Netlify Functions in the same site as the app | DECIDED |
| Runtime | Node 22 LTS | PROPOSED (Node 22 is an LTS line; the worker uses it too) |
| Language | TypeScript | PROPOSED |
| Validation | Zod (request and response schemas) | PROPOSED |
| Database access | Supabase JS (service role for server-side work, user JWT for user actions) | PROPOSED |
| Idempotency | `Idempotency-Key` header stored in a table, 24-hour retention | PROPOSED |
| Function limits | Short requests only. Uploads go direct to Storage. Long jobs go to the worker. | DECIDED (architecture) |
| Scheduled functions | Not used for scheduling. The worker runs scheduled jobs. | PROPOSED |

**Limits to design around:** Netlify Functions have execution-time and payload limits (verify the current values on Netlify's documentation at Phase 0). The design avoids both: file uploads go directly to Supabase Storage, and exports and translations run on the worker.

---

## 4. Database, auth and storage (Supabase)

| Item | Choice | Status |
|---|---|---|
| Region | India (Mumbai) | DECIDED (decision 33). O-A4: confirm on the plan |
| Engine | Postgres 15 or later | PROPOSED (required for `NULLS NOT DISTINCT` in the schema) |
| Schema management | Supabase CLI migrations, SQL files in the repo | PROPOSED |
| Row Level Security | Enabled on every table | DECIDED (architecture) |
| Auth | Email magic link (invite and reset) and password login | DECIDED (decision 21) |
| MFA | Not in pilot | A-S1 (to confirm) |
| Email provider | Supabase default or custom SMTP | OPEN (O-A3) |
| Storage | Supabase Storage, private buckets, signed URLs, resumable (TUS) uploads | DECIDED (decision 30), method PROPOSED |
| Realtime | For the notification bell, with polling as fallback | PROPOSED |
| Backups | Plan-dependent (daily; point-in-time recovery if available) | OPEN (O-A9) |
| Local development | Supabase local stack via Supabase CLI | PROPOSED |

**Storage limits to confirm:** per-file size limit on the plan, total storage, bandwidth. DWG and RVT files can be large. (O-A9)

---

## 5. Worker (WhatsApp, scheduler, exports, APS jobs)

| Item | Choice | Status |
|---|---|---|
| Host | Hostinger VPS, Docker, 2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth | DECIDED (provided) |
| Location | India | OPEN (O2): confirm the data centre location on the plan |
| Runtime | Node 22 LTS, TypeScript | PROPOSED |
| WhatsApp client (pilot) | `whatsapp-web.js` | DECIDED (pilot). Version to pin at Phase 7; the reference repo used 1.34.7 |
| Headless browser | Chromium in the Docker image, used by `whatsapp-web.js` | PROPOSED |
| WhatsApp client (production) | Meta WhatsApp Cloud API (adapter behind the same outbox) | DECIDED (production) |
| Scheduler | In-process scheduler with a Postgres advisory lock, so two instances can't run one job | PROPOSED |
| Jobs | Outbox sender (10 s), digest (admin time, IST), escalations (hourly), conflict overdue (hourly), APS translation polling, export builder, session health (1 min) | PROPOSED |
| Excel import parsing | ExcelJS | PROPOSED |
| Encryption for export archives | AES-256 encrypted archive, admin holds the key. Format to choose: ZIP AES-256 or `age` | OPEN (O-T3) |
| Logging | Structured JSON to stdout, collected by Hostinger | PROPOSED |
| Secrets | Environment file on the VPS, permissions locked, not in the image | PROPOSED |
| Updates | Rebuild the image from a commit tag and restart; keep the previous tag for rollback | PROPOSED |

**Important:** the WhatsApp session data is stored on a Docker volume on the VPS. The volume is encrypted at rest if the Hostinger plan supports it, otherwise encrypted with a key stored outside the VPS. (O-T4)

---

## 6. AI (Gemini)

| Item | Choice | Status |
|---|---|---|
| Provider | Google Gemini API | DECIDED (decision 7) |
| Where it runs | Worker only. The browser never sees the key | DECIDED (architecture) |
| SDK | `@google/genai` (Google's current SDK). **Do not use** `@google/generative-ai`, which the reference uses and which Google has been replacing. Verify before Phase 8 | PROPOSED |
| Model | A Flash-class Gemini model, exact ID chosen and pinned at Phase 8 after checking current availability and terms | OPEN until Phase 8 |
| Tools | None. No web search, no function calling | DECIDED (architecture) |
| Input | Structured rows from the database only | DECIDED |
| Output validation | Every number, sheet number and date in the output must match an input row; otherwise fall back to deterministic text | DECIDED |
| Data policy | Digest rows leave the firm's systems. Firm must confirm this is allowed (O-A6) | OPEN |

---

## 7. Drawing viewing (Autodesk Platform Services)

| Item | Choice | Status |
|---|---|---|
| Services | Model Derivative API (translation to web format), Viewer SDK (browser viewer), Object Storage (for source copy) | DECIDED (decision 28) |
| Formats | DWG, RVT, IFC, NWD | DECIDED (decision 27). NWD support to verify (O4) |
| Authentication | Server-side two-legged token, read-scoped token to the browser, secret never in the browser | PROPOSED (follows APS guidance; verify at Phase 2) |
| Pricing | Free tier and paid tiers. Pricing for expected volume to confirm before Phase 2 (O5) | OPEN |
| Copy stored at Autodesk | Source copy is required for translation. Acceptance to confirm (O-A7) | OPEN |
| Client NDA check | Per-client flag; clients with NDA forbidding APS see PDF only | PROPOSED |

---

## 8. Hosting and infrastructure

| Component | Host | Notes | Status |
|---|---|---|---|
| Web app (static) | Netlify | Built by Netlify from the repo | DECIDED |
| API | Netlify Functions | Same Netlify site | DECIDED |
| Database, auth, storage | Supabase, India | Staging and production projects | DECIDED |
| Worker | Hostinger VPS, Docker | One container for pilot; staging container optional | DECIDED |
| DNS and TLS | Netlify for the app, custom domain to confirm | Domain name not yet chosen | OPEN |
| Monitoring | Health endpoints, Supabase and Netlify dashboards, Sentry optional | | PROPOSED |

**Environments:** development, staging, production, for each of the three platforms. Secrets differ per environment (ARCHITECTURE.md, section 11).

---

## 9. Developer tooling

| Item | Choice | Status |
|---|---|---|
| Repository layout | One repository with `apps/web`, `netlify/functions`, `apps/worker`, `supabase/` (migrations, seeds, tests), `packages/shared` (types and validation) | PROPOSED |
| Node version pin | `.nvmrc` at 22 | PROPOSED |
| Package manager | npm (reference uses npm with a lockfile) | REFERENCE |
| Lint | ESLint | PROPOSED |
| Format | Prettier: `printWidth 100`, single quotes, Angular parser for templates | REFERENCE |
| Git hosting and CI | Not confirmed. If GitHub is used: GitHub Actions. | OPEN (O-T5) |
| Commit style | Short imperative messages, one change per commit | PROPOSED |
| Code review | Every change reviewed by one other person before merge | PROPOSED |

---

## 10. Things we are deliberately not using

| Item | Reason |
|---|---|
| Multi-tenant features (tenant headers, tenant modules) | One firm, one product. Revisit only if the product is sold to other firms |
| Public website, shop, payments | Not in scope |
| Multi-language (`ngx-translate`) | English only (decision 43) |
| Runtime white-label branding | Single firm brand (no white-label in scope) |
| PWA and offline mode | Not in scope; connection required |
| Quill rich-text editor | Conflict content is plain text |
| Native mobile apps | Responsive web only |
| Desktop CAD software for viewing | Rejected by owner: browser viewing only |
| `whatsapp-web.js` for production | Ban risk, not approved for regulated use (OpenWA README; our decision 3) |
| OpenWA gateway | We build the owner-only worker ourselves; OpenWA was reviewed as reference only |
| Personal WhatsApp via browser automation (Playwright on a personal account) | Ruled out in our discussion |

---

## 11. Decisions this stack needs from you

| ID | Question | Recommendation |
|---|---|---|
| O-T1 | Frontend framework: Angular (matches the reference design system) or React | Angular. Switching to React means rewriting the `ds-*` components, though the tokens and rules carry over. |
| O-T2 | Unit test runner: Karma and Jasmine (reference) or Vitest | Karma and Jasmine, to match the reference, unless you prefer Vitest |
| O-T3 | Export archive encryption format | AES-256 ZIP, with the key held by the admin |
| O-T4 | Encryption of the WhatsApp session volume | Encrypted volume if available; otherwise key stored off the VPS |
| O-T5 | Git host and CI | Confirm where the code will live |
| O-A3 | Email provider | Supabase default for pilot; custom SMTP for production |
| O-A8 | Sentry | Yes, for error tracking, with personal data scrubbed |

Other open items (O-A4, O-A5, O-A6, O-A7, O2, O3, O4, O5) are listed in ARCHITECTURE.md, section 15 and PRD.md.
