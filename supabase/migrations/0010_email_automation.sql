-- WebinarOS — Phase 5: email templates, campaigns, automation, and a jobs queue.

-- =============================================================================
-- email_templates — reusable templated emails. Variables use {{snake_case}}.
-- =============================================================================
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  subject text not null,
  html text not null,
  text text,
  from_name text,
  from_email text,
  reply_to text,
  variables jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists email_templates_org_idx on public.email_templates(organization_id, name);

alter table public.email_templates enable row level security;

create policy "email_templates_read_members"
  on public.email_templates for select using (public.is_org_member(organization_id));
create policy "email_templates_write_managers"
  on public.email_templates for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_email_templates on public.email_templates;
create trigger touch_email_templates before update on public.email_templates
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- campaigns — a one-shot bulk send to a selected audience.
-- =============================================================================
do $$ begin
  create type public.campaign_status as enum ('draft','scheduled','sending','sent','paused','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audience_kind as enum (
    'all_registrants','all_attendees','webinar_registrants','webinar_attendees',
    'lead_tier','manual'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  template_id uuid references public.email_templates(id) on delete set null,
  status public.campaign_status not null default 'draft',
  audience_kind public.audience_kind not null default 'manual',
  audience_config jsonb not null default '{}'::jsonb,  -- e.g. { webinar_id, tier }
  scheduled_at timestamptz,
  sent_at timestamptz,
  totals jsonb not null default '{}'::jsonb,           -- {queued, sent, failed}
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_org_idx on public.campaigns(organization_id, created_at desc);
create index if not exists campaigns_status_idx on public.campaigns(organization_id, status);

alter table public.campaigns enable row level security;

create policy "campaigns_read_members"
  on public.campaigns for select using (public.is_org_member(organization_id));
create policy "campaigns_write_managers"
  on public.campaigns for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_campaigns on public.campaigns;
create trigger touch_campaigns before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- campaign_recipients — one row per planned send.
-- =============================================================================
do $$ begin
  create type public.recipient_status as enum ('queued','sent','failed','skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email text not null,
  variables jsonb not null default '{}'::jsonb,
  status public.recipient_status not null default 'queued',
  provider_message_id text,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_recipients_campaign_idx
  on public.campaign_recipients(campaign_id, status);
create unique index if not exists campaign_recipients_unique
  on public.campaign_recipients(campaign_id, lower(email));

alter table public.campaign_recipients enable row level security;

create policy "campaign_recipients_read_members"
  on public.campaign_recipients for select using (public.is_org_member(organization_id));

-- =============================================================================
-- automation_workflows — trigger → steps.
-- =============================================================================
do $$ begin
  create type public.workflow_status as enum ('draft','active','paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workflow_trigger as enum (
    'registrant_created','attendance_recorded','lead_scored','manual'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status public.workflow_status not null default 'draft',
  trigger public.workflow_trigger not null default 'manual',
  trigger_config jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_org_trigger_idx
  on public.automation_workflows(organization_id, trigger, status);

alter table public.automation_workflows enable row level security;

create policy "workflows_read_members"
  on public.automation_workflows for select using (public.is_org_member(organization_id));
create policy "workflows_write_managers"
  on public.automation_workflows for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_workflows on public.automation_workflows;
create trigger touch_workflows before update on public.automation_workflows
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- automation_runs — one row per fire.
-- =============================================================================
do $$ begin
  create type public.run_status as enum ('pending','running','completed','failed','skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  trigger_entity_type text,
  trigger_entity_id text,
  status public.run_status not null default 'pending',
  current_step integer not null default 0,
  context jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists automation_runs_workflow_idx
  on public.automation_runs(workflow_id, created_at desc);
create index if not exists automation_runs_status_idx
  on public.automation_runs(organization_id, status);

alter table public.automation_runs enable row level security;

create policy "automation_runs_read_members"
  on public.automation_runs for select using (public.is_org_member(organization_id));

-- =============================================================================
-- jobs — durable queue; a Vercel cron hits /api/jobs/tick and drains it.
-- =============================================================================
do $$ begin
  create type public.job_status as enum ('pending','running','completed','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null,                                    -- 'send_email' | 'run_workflow_step' | 'send_campaign_batch'
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'pending',
  priority integer not null default 100,
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_ready_idx
  on public.jobs(run_at, priority)
  where status = 'pending';
create index if not exists jobs_org_idx on public.jobs(organization_id, created_at desc);
create unique index if not exists jobs_idempotency_unique
  on public.jobs(idempotency_key) where idempotency_key is not null;

alter table public.jobs enable row level security;

-- Admins can see what's queued; writes are server-side only (service role).
create policy "jobs_read_admins"
  on public.jobs for select
  using (
    organization_id is not null
    and public.org_role(organization_id) in ('owner','admin')
  );

drop trigger if exists touch_jobs on public.jobs;
create trigger touch_jobs before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Atomic claim function: returns one ready job and locks it in a single
-- statement so parallel workers never pick the same row.
create or replace function public.claim_next_job(worker text, lease_seconds integer default 60)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  update public.jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = worker,
      attempts = j.attempts + 1,
      updated_at = now()
  where j.id = (
    select id from public.jobs
    where status = 'pending'
      and run_at <= now()
    order by priority asc, run_at asc
    limit 1
    for update skip locked
  )
  returning j.* into claimed;
  return claimed;
end;
$$;
