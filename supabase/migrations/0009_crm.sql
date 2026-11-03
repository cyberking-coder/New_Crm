-- WebinarOS — Phase 4: CRM (companies, contacts, leads, activities, tasks, pipeline).

-- =============================================================================
-- companies
-- =============================================================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text,
  size text,
  industry text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_org_idx on public.companies(organization_id, name);
create unique index if not exists companies_org_domain_unique
  on public.companies(organization_id, lower(domain))
  where domain is not null;

alter table public.companies enable row level security;

create policy "companies_read_members"
  on public.companies for select using (public.is_org_member(organization_id));
create policy "companies_write_managers"
  on public.companies for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_companies on public.companies;
create trigger touch_companies before update on public.companies
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- contacts
-- =============================================================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  email text not null,
  full_name text,
  title text,
  phone text,
  linkedin_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_org_email_unique
  on public.contacts(organization_id, lower(email));
create index if not exists contacts_company_idx on public.contacts(company_id);

alter table public.contacts enable row level security;

create policy "contacts_read_members"
  on public.contacts for select using (public.is_org_member(organization_id));
create policy "contacts_write_managers"
  on public.contacts for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_contacts on public.contacts;
create trigger touch_contacts before update on public.contacts
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- pipeline_stages — ordered stages per org. Seed with defaults on first use.
-- =============================================================================
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  position integer not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists pipeline_stages_org_idx on public.pipeline_stages(organization_id, position);

alter table public.pipeline_stages enable row level security;

create policy "stages_read_members"
  on public.pipeline_stages for select using (public.is_org_member(organization_id));
create policy "stages_write_admins"
  on public.pipeline_stages for all
  using (public.org_role(organization_id) in ('owner','admin'))
  with check (public.org_role(organization_id) in ('owner','admin'));

-- Seed default stages for every existing org, and for every future org via a trigger.
create or replace function public.seed_pipeline_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pipeline_stages (organization_id, key, label, position, is_won, is_lost) values
    (new.id, 'new',       'New',       0, false, false),
    (new.id, 'qualified', 'Qualified', 1, false, false),
    (new.id, 'meeting',   'Meeting',   2, false, false),
    (new.id, 'proposal',  'Proposal',  3, false, false),
    (new.id, 'won',       'Won',       4, true,  false),
    (new.id, 'lost',      'Lost',      5, false, true)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_org_seed_stages on public.organizations;
create trigger on_org_seed_stages
  after insert on public.organizations
  for each row execute function public.seed_pipeline_stages();

-- Backfill existing orgs.
insert into public.pipeline_stages (organization_id, key, label, position, is_won, is_lost)
select o.id, s.key, s.label, s.position, s.is_won, s.is_lost
from public.organizations o
cross join (values
  ('new','New',0,false,false),
  ('qualified','Qualified',1,false,false),
  ('meeting','Meeting',2,false,false),
  ('proposal','Proposal',3,false,false),
  ('won','Won',4,true,false),
  ('lost','Lost',5,false,true)
) as s(key, label, position, is_won, is_lost)
on conflict do nothing;

-- =============================================================================
-- leads — a qualified prospect, usually derived from a webinar registrant.
-- =============================================================================
do $$ begin
  create type public.lead_tier as enum ('cold','warm','hot');
exception when duplicate_object then null; end $$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  source_registrant_id uuid references public.webinar_registrants(id) on delete set null,
  source_webinar_id uuid references public.webinars(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text,
  company_name text,
  score integer not null default 0 check (score between 0 and 100),
  tier public.lead_tier not null default 'cold',
  score_rationale jsonb not null default '[]'::jsonb,
  suggested_action text,
  value_cents integer,
  currency text default 'USD',
  last_touched_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_org_email_unique on public.leads(organization_id, lower(email));
create index if not exists leads_org_stage_idx on public.leads(organization_id, stage_id);
create index if not exists leads_org_score_idx on public.leads(organization_id, score desc);
create index if not exists leads_source_registrant_idx on public.leads(source_registrant_id);

alter table public.leads enable row level security;

create policy "leads_read_members"
  on public.leads for select using (public.is_org_member(organization_id));
create policy "leads_write_managers"
  on public.leads for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_leads on public.leads;
create trigger touch_leads before update on public.leads
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- lead_activities — append-only timeline of touches on a lead.
-- =============================================================================
do $$ begin
  create type public.activity_kind as enum (
    'note','email_sent','email_received','call','meeting','ai_summary',
    'stage_change','score_change','task_created','task_completed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.activity_kind not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, created_at desc);
create index if not exists lead_activities_org_idx on public.lead_activities(organization_id, created_at desc);

alter table public.lead_activities enable row level security;

create policy "lead_activities_read_members"
  on public.lead_activities for select using (public.is_org_member(organization_id));
create policy "lead_activities_write_managers"
  on public.lead_activities for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

-- =============================================================================
-- sales_tasks — follow-ups.
-- =============================================================================
do $$ begin
  create type public.task_status as enum ('open','in_progress','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.sales_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  details text,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_tasks_org_due_idx
  on public.sales_tasks(organization_id, due_at) where status in ('open','in_progress');
create index if not exists sales_tasks_lead_idx on public.sales_tasks(lead_id, created_at desc);

alter table public.sales_tasks enable row level security;

create policy "sales_tasks_read_members"
  on public.sales_tasks for select using (public.is_org_member(organization_id));
create policy "sales_tasks_write_managers"
  on public.sales_tasks for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_sales_tasks on public.sales_tasks;
create trigger touch_sales_tasks before update on public.sales_tasks
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- engagement_summaries — AI-written summaries per webinar session.
-- =============================================================================
create table if not exists public.engagement_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  top_questions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists engagement_summaries_webinar_idx
  on public.engagement_summaries(webinar_id, created_at desc);

alter table public.engagement_summaries enable row level security;

create policy "engagement_summaries_read_members"
  on public.engagement_summaries for select using (public.is_org_member(organization_id));
