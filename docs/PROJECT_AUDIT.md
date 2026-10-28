# WebinarOS — Project Audit

**Date:** 2026-10-28
**Branch:** `claude/pensive-keller-mf3sig`

## Repository State at Audit

The repository was **empty** at the start of this engagement — a bare `.git` directory with no commits on any branch. There was no package.json, no source code, no documentation, no CI configuration, and no infrastructure.

**Consequence:** Phase 1 is a greenfield bootstrap rather than a refactor. There is no existing functionality to preserve, no incomplete features to triage, and no design conventions to inherit. All architectural choices in this phase are forward-looking defaults; subsequent phases will refine them in response to real requirements.

## Chosen Stack (justification)

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server actions, streaming, route handlers, co-located auth. Aligns with the brief's preferred stack. |
| Language | TypeScript (strict) | Required by brief. |
| Styling | Tailwind CSS v3 + CSS variables | Design-token driven, dark-mode ready, interoperable with shadcn/ui. |
| Components | shadcn/ui conventions | Owned-source primitives, no runtime lock-in. Primitives added incrementally as features need them (not vendored en masse). |
| Icons | lucide-react | Brief default. |
| Database | Supabase Postgres | Brief default; delivers Auth + RLS + Storage in one platform. |
| Auth | Supabase Auth (email magic-link + password) | Row Level Security on the same identity. |
| Forms | React Hook Form + Zod | Brief default; shared Zod schemas for server validation. |
| Charts | Recharts (Phase 6) | Deferred — no charts in Phase 1. |
| Testing | Vitest + Playwright | Added in Phase 7; a minimal Vitest config lands in Phase 1 so later phases have a home for unit tests. |

## Architecture Boundaries

```
src/
  app/                 UI routes (server components by default)
    (auth)/            Public auth routes (sign-in, sign-up, callback)
    (app)/             Authenticated shell — requires org membership
  components/
    ui/                shadcn primitives (added as needed)
    layout/            Sidebar, topbar, shell chrome
  lib/
    supabase/          Browser + server clients, typed helpers
    auth/              Session + org-membership guards
    db/                Typed query helpers (Phase 2+)
  types/               Database.ts (generated), domain types
supabase/
  migrations/          SQL migrations — source of truth for schema
```

Provider adapters (webinar provider, email, CRM, payments) live under `src/lib/integrations/<provider>/` and are introduced in Phase 3+. No adapter ships in Phase 1.

## Multi-Tenancy Model

- `organizations` is the tenant root. Every business row carries `organization_id`.
- `organization_members(organization_id, user_id, role)` is the join. Roles: `owner`, `admin`, `manager`, `member`.
- RLS policies gate every tenant-scoped table by membership. Service-role keys never leave the server.
- A signed-in user with no memberships is routed to an onboarding step that creates their first organization.

## Risks

1. **No credentials present.** Supabase URL/keys, provider keys, and AI keys are all absent. Phase 1 ships `.env.example` and the code reads from env vars; actual service wiring is Phase 2+ once the user supplies credentials.
2. **Scope compression.** The brief covers seven phases of enterprise functionality. Each phase will likely surface schema revisions. Migrations will be additive and documented.
3. **Provider capability drift.** Webinar/email/CRM providers are not chosen yet. The adapter boundary in Phase 3 will be defined once the user names the providers.

## Phase 1 Scope (this delivery)

- Repository bootstrap (package.json, tsconfig, next.config, Tailwind, ESLint).
- Design tokens + minimal shadcn primitives (`button`, `input`, `label`, `card`).
- Supabase browser + server clients, middleware session refresh.
- `0001_tenancy.sql` migration: `organizations`, `organization_members`, `user_profiles`, `audit_logs` with RLS.
- Auth routes: sign-in, sign-up, email callback, sign-out.
- Authenticated app shell: deep-navy sidebar with the full navigation groups from the brief, placeholder route pages for each item.
- Onboarding flow: new user without an org creates one.
- `docs/IMPLEMENTATION_PLAN.md` with the seven-phase checklist.

**Out of scope for Phase 1:** webinars, registrants, email, AI, analytics, integrations, charts, Playwright, CI.

## Verification Performed

- `tsc --noEmit` — type-checks clean.
- `next build` — not run in this environment (no network for npm install at build time was assumed; see IMPLEMENTATION_PLAN for the install/verify steps the user runs locally with credentials).
- RLS migration reviewed statically; `supabase db reset` to be run by the user against their project.
