# Tech Stack (current, 16 Oct 2026)

This replaces the earlier stack. Hostinger, Docker, Netlify and the whatsapp-web.js worker are removed.

| Area | Choice | Why |
|---|---|---|
| Web app | Next.js 15 (App Router), React 19, Tailwind v4 | Server actions and route handlers keep secrets on the server |
| Hosting | Vercel | Matches the Vercel-only deployment decision. Routes run the messaging code. |
| Database, auth, storage | Supabase (Postgres, Auth, Storage, RLS) | Row-level security enforced in the database; signed upload URLs for large files |
| Server data access | Service-role client in server code; user tokens for direct reads under RLS | Keeps rules in one place; RLS is tested |
| WhatsApp (pilot) | whatsapp-web.js in `apps/whatsapp-web` (`WhatsAppWeb.js`), QR login, dedicated test number, owner and allowlisted numbers only | Needs an always-on host. Session encrypted in Supabase (AES-256-GCM). Unofficial API: accepted ban risk. |
| WhatsApp (clients, production) | WhatsApp Cloud API (Meta Graph v21.0 default) | Official channel for client-facing messages. |
| Scheduling | Vercel Cron → `GET /api/cron/tick` every minute (Pro) | Digest, escalations, checks and outbox pass |
| Immediate sends | `after()` in route handlers after events and webhooks | Messages go out without waiting for the next cron run |
| AI wording | Gemini via `@google/genai`, server only | Optional. Output is checked against source numbers. |
| CAD | Autodesk Platform Services: OSS signed upload, Model Derivative (svf2), Viewer SDK | Translates DWG, RVT, IFC, NWD for viewing. Endpoints not yet verified live. |
| PDF output | pdf-lib (A4 landscape tables) | Register and dashboard reports |
| Excel output | xlsx (SheetJS) | Register, issues, transmittals, changes |
| Domain logic | TypeScript package `@arch-flow/domain`, vitest | Pure functions, tested without the database |
| Messaging logic | TypeScript package `@arch-flow/messaging` | Outbox, retries, duplicate suppression, digest, webhook verification |
| Tests | vitest (unit), Playwright (browser smoke), PostgreSQL 16 (RLS) | |

## Removed

- Hostinger hosting and the Hostinger-hosted worker. Not needed on Vercel.
- Docker image for the worker. Docker is not available in the build environment.
- The whatsapp-web.js worker from the first design. Replaced by the Vercel routes plus the `apps/whatsapp-web` process. Vercel itself cannot hold a WhatsApp Web session.
- Netlify configuration.

## Configuration

Every API key, token and secret comes from environment variables. See `.env.example`.
