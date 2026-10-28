# WebinarOS — Implementation Plan

Seven phases. Each phase gates on the previous. Each ends in a user review.

## Phase 1 — Foundation *(this delivery)*

- [x] Repository audit (`docs/PROJECT_AUDIT.md`).
- [x] Next.js 15 + TypeScript strict + Tailwind + ESLint scaffold.
- [x] Design tokens (deep navy sidebar, warm-neutral canvas, blue accent).
- [x] shadcn-style primitives: button, input, label, card.
- [x] Supabase browser/server clients + middleware session refresh.
- [x] Migration `0001_tenancy.sql`: organizations, organization_members, user_profiles, audit_logs with RLS.
- [x] Auth: sign-in, sign-up, email callback, sign-out.
- [x] Authenticated app shell with full navigation per brief §6.
- [x] Onboarding: first-org creation for new users.

**Blockers after this phase:** Supabase project + env vars must be provided before Phase 2.

## Phase 2 — Webinars, Registrations, Registrants

- Migration `0002_webinars.sql`: webinars, webinar_sessions, webinar_registrants, landing_pages.
- Webinar list + create + edit (live, automated, hybrid, recurring).
- Public registration pages (`/r/[slug]`) with RHF+Zod, server validation.
- Registrant table with pagination, filters, CSV export.
- Session scheduling, timezone-safe times.

## Phase 3 — Attendance, Recordings, Engagement

- Webinar provider adapter boundary + first adapter (TBD provider).
- Attendance tracking webhook (idempotent).
- Recordings table + Supabase Storage policy.
- Engagement events, polls, Q&A, offers schemas and UI.

## Phase 4 — AI, Leads, Pipeline

- Server-side Claude integration with Zod-validated structured outputs.
- Engagement summary + explainable lead score per attendee.
- Leads, contacts, companies, lead_activities, sales_tasks, pipeline stages, follow-up queue.

## Phase 5 — Email, Automation, Jobs

- Email provider adapter + templates, campaigns, campaign_recipients.
- Automation workflows (trigger → steps), automation_runs.
- Durable job queue (pg_cron + a `jobs` table, or a managed scheduler) for reminders, follow-ups, retries.

## Phase 6 — Analytics, Integrations, Webhooks

- Webinar performance, registration sources, attendance/engagement, lead conversion, revenue/attribution views (materialized where needed).
- CRM (HubSpot/Mailchimp), payments (Stripe), outbound Zapier-compatible webhooks.
- Webhook event store + replay + integration health page.

## Phase 7 — Hardening

- Security review (RLS, server authz, secret handling).
- Performance pass (indexes, N+1 audit, image/font budget).
- a11y pass (labels, keyboard, contrast).
- Playwright for critical paths: sign-up → create org → create webinar → register → attend → see lead.
- Deployment runbook + env matrix.

## Protocol per phase

Inspect → scope → implement → `pnpm format && pnpm lint && pnpm typecheck && pnpm test` → fix → verify prior phases still work → update this file → report → **await approval**.
