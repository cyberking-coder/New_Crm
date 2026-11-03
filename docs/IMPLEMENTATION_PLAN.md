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

- [x] Migration `0002_webinars.sql`: webinars, webinar_sessions, webinar_registrants.
- [x] Webinar list + create + edit (live/automated/hybrid/recurring).
- [x] Session scheduling with timezone-safe rendering (`Intl.DateTimeFormat` + stored IANA tz).
- [x] Registrants list with pagination, search, webinar + status filters.
- [x] CSV export via `/api/registrations/export`.
- [x] Dashboard counts (webinars, registrations, upcoming sessions) from real queries.
- [x] **Removed by user request:** landing pages, block builder, public `/r/[slug]`
      registration flow, and the plugin registry. Drop migration
      `0008_drop_landing_and_plugins.sql` is available (opt-in).

## Phase 3 — Attendance, Recordings, Engagement *(this delivery)*

- [x] Migrations `0003_attendance_engagement.sql` + `0004_storage.sql`:
      integration_connections, attendance_sessions, engagement_events, polls,
      poll_responses, questions, offers, recordings, webhook_events (dedupe
      unique index on `(connection_id, external_event_id)`), plus a
      `recordings` Supabase Storage bucket with org-scoped RLS.
- [x] Adapter boundary at `src/lib/integrations/webinar/` with
      `WebinarAdapter` interface, a `manual` adapter (documented portable
      JSON + HMAC-SHA256 signature) and a `zoom` adapter (participant +
      recording events, Zoom's v0 timestamp signature).
- [x] Idempotent webhook endpoint `POST /api/webhooks/webinar/[connectionId]`:
      verifies signature → dedupes via `webhook_events(external_event_id)` →
      inserts attendance / engagement / recording rows → promotes registrant
      status to `attended` on first join.
- [x] `/integrations/webinar` page: add/pause/delete connections, auto-generated
      webhook secret, copy-ready webhook URL, documented manual payload format.
- [x] `/audience/attendees`, `/audience/engagement`, `/audience/questions` show
      real data (empty-state when nothing has arrived).
- [x] `/webinars/recordings`: list + add external URL + delete.
- [x] Webinar detail header now shows registrants / attended / recordings counts.

## Phase 4 — AI, Leads, Pipeline *(this delivery)*

- [x] Migration `0009_crm.sql`: companies, contacts, leads, lead_activities,
      sales_tasks, pipeline_stages (seeded via trigger + backfill), lead_tier
      enum, activity_kind enum, engagement_summaries.
- [x] Server-side Anthropic client (`src/lib/ai/anthropic.ts`) — Zod-validated
      JSON responses, model + token tracking, one retry on validation failure,
      explicit AIConfigError when key is missing.
- [x] `scoreLead()` and `summarizeEngagement()` features with strict Zod schemas.
- [x] `scoreRegistrantAction()` — pulls signals (attendance minutes, poll
      answers, questions, offer clicks, chat, UTM, webinar context), calls
      Claude, upserts a lead, writes a `score_change` activity with full
      rationale, suggested action, and token usage.
- [x] `/sales/leads` list with tier/stage/search filters.
- [x] `/sales/leads/[id]` detail: score + rationale card, pipeline stage picker
      (persisted), tasks sub-card with add-task, note form, activity timeline.
- [x] `/sales/pipeline` grouped-by-stage view (lightweight kanban-style).
- [x] `/sales/follow-up` with overdue/today/upcoming/later/someday buckets,
      standalone task creation.
- [x] `/sales/contacts` with contacts + companies tables, add-contact form that
      auto-creates/links the company.
- [x] "AI score" button on Registrations table rows.
- [x] Dashboard shows live Leads and Open-tasks counts.
- [x] `.env.example` adds `ANTHROPIC_API_KEY` + optional `ANTHROPIC_MODEL`.

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
