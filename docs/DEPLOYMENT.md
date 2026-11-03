# Deployment notes

## Job queue scheduling

`vercel.json` ships with a **daily** cron (`0 0 * * *`) so the deploy passes on
Vercel Hobby, which permits one cron per day only. Daily cadence is **not**
sufficient for real email delivery — campaigns and workflow steps would wait up
to 24 hours between ticks. Pick one of:

### Option A — Upgrade to Vercel Pro (easiest)

Pro allows minute-granularity cron. Edit `vercel.json` to:

```json
{ "crons": [{ "path": "/api/jobs/tick", "schedule": "* * * * *" }] }
```

Push. Done.

### Option B — External scheduler (free)

Keep the daily cron in `vercel.json` (or remove the `crons` block entirely) and
drive the queue from an external service that can hit a URL every minute:

- **cron-job.org** (free, 1-minute minimum)
- **EasyCron** (free tier)
- **GitHub Actions** with a `schedule: '* * * * *'` trigger that `curl`s the
  tick endpoint

The request must be:

```
POST https://<your-domain>/api/jobs/tick
Authorization: Bearer <JOBS_RUNNER_SECRET value>
```

Set `JOBS_RUNNER_SECRET` in Vercel env to any long random string, and configure
the same value in the scheduler's Authorization header.

### Option C — Fire from the client at the moment of enqueue

Not recommended for production (loses durability on client-close), but useful
for local dev: after `enqueueJob()` the UI can POST to `/api/jobs/tick` without
auth (dev-only — the endpoint allows unauthenticated calls when
`NODE_ENV !== "production"` and no secret is set).

---

## Required environment variables

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role
- `ANTHROPIC_API_KEY` — AI scoring + summaries
- `JOBS_RUNNER_SECRET` — bearer token the cron sends to `/api/jobs/tick`
  (production only; local dev can omit)

Public (safe for the browser):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:
- `SITE_URL` — canonical site URL for emails that render outside a request
  context (not needed if your Vercel domain is enough)
- `ANTHROPIC_MODEL` — override the default `claude-sonnet-5-5`

## Running migrations

Apply migrations in order in Supabase SQL Editor:

```
supabase/migrations/0001_tenancy.sql
supabase/migrations/0002_webinars.sql
supabase/migrations/0003_attendance_engagement.sql
supabase/migrations/0004_storage.sql
supabase/migrations/0007_settings.sql
supabase/migrations/0009_crm.sql
supabase/migrations/0010_email_automation.sql
```

Skipped intentionally (per earlier removal):
- `0005_landing_blocks.sql`, `0006_plugins.sql`
- Opt-in drop: `0008_drop_landing_and_plugins.sql` — only if you want to
  purge the landing/plugin tables entirely.
