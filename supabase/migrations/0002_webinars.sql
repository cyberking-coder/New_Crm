-- WebinarOS — Phase 2: Webinars, sessions, landing pages, registrants.

-- =============================================================================
-- Enums
-- =============================================================================
do $$ begin
  create type public.webinar_type as enum ('live','automated','hybrid','recurring');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.webinar_status as enum ('draft','scheduled','live','ended','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.registrant_status as enum ('registered','attended','no_show','cancelled');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- webinars
-- =============================================================================
create table if not exists public.webinars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  type public.webinar_type not null default 'live',
  status public.webinar_status not null default 'draft',
  timezone text not null default 'UTC',
  host_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists webinars_org_idx on public.webinars(organization_id, created_at desc);
create index if not exists webinars_status_idx on public.webinars(organization_id, status);

alter table public.webinars enable row level security;

create policy "webinars_read_members"
  on public.webinars for select
  using (public.is_org_member(organization_id));

create policy "webinars_insert_members"
  on public.webinars for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());

create policy "webinars_update_managers"
  on public.webinars for update
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

create policy "webinars_delete_admins"
  on public.webinars for delete
  using (public.org_role(organization_id) in ('owner','admin'));

drop trigger if exists touch_webinars on public.webinars;
create trigger touch_webinars before update on public.webinars
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- webinar_sessions — one or more scheduled instances of a webinar.
-- =============================================================================
create table if not exists public.webinar_sessions (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 1 and 1440),
  status text not null default 'scheduled',
  provider_session_id text,
  join_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_webinar_idx on public.webinar_sessions(webinar_id, scheduled_at);
create index if not exists sessions_org_scheduled_idx
  on public.webinar_sessions(organization_id, scheduled_at desc);

alter table public.webinar_sessions enable row level security;

create policy "sessions_read_members"
  on public.webinar_sessions for select using (public.is_org_member(organization_id));

create policy "sessions_write_managers"
  on public.webinar_sessions for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_webinar_sessions on public.webinar_sessions;
create trigger touch_webinar_sessions before update on public.webinar_sessions
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- landing_pages — 1:1 with a webinar; served publicly at /r/<slug>.
-- =============================================================================
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null unique references public.webinars(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  public_slug text not null unique,
  headline text not null,
  subheadline text,
  body_md text,
  cta_label text not null default 'Register now',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_pages_org_idx on public.landing_pages(organization_id);

alter table public.landing_pages enable row level security;

-- Published pages are readable by anyone (including anon) — that's the point of a landing page.
create policy "landing_pages_public_read"
  on public.landing_pages for select
  using (is_published = true);

create policy "landing_pages_members_read"
  on public.landing_pages for select
  using (public.is_org_member(organization_id));

create policy "landing_pages_write_managers"
  on public.landing_pages for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_landing_pages on public.landing_pages;
create trigger touch_landing_pages before update on public.landing_pages
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- webinar_registrants — registrations submitted via the landing page.
-- =============================================================================
create table if not exists public.webinar_registrants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  email text not null,
  full_name text,
  phone text,
  company text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  consent_marketing boolean not null default false,
  status public.registrant_status not null default 'registered',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists registrants_unique_per_session
  on public.webinar_registrants(webinar_id, lower(email), coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists registrants_org_created_idx
  on public.webinar_registrants(organization_id, created_at desc);
create index if not exists registrants_webinar_idx
  on public.webinar_registrants(webinar_id, created_at desc);

alter table public.webinar_registrants enable row level security;

create policy "registrants_read_members"
  on public.webinar_registrants for select
  using (public.is_org_member(organization_id));

create policy "registrants_update_managers"
  on public.webinar_registrants for update
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

create policy "registrants_delete_admins"
  on public.webinar_registrants for delete
  using (public.org_role(organization_id) in ('owner','admin'));

-- Public inserts go through the service-role client in a server action that validates the
-- landing page is published. No anon INSERT policy on this table.

-- =============================================================================
-- Helper: auto-create a landing page row when a webinar is created.
-- =============================================================================
create or replace function public.create_landing_page_for_webinar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := new.slug;
  v_candidate text := v_slug;
  v_i int := 1;
begin
  -- public_slug must be globally unique; add -N suffix on collision.
  while exists (select 1 from public.landing_pages where public_slug = v_candidate) loop
    v_i := v_i + 1;
    v_candidate := v_slug || '-' || v_i;
    exit when v_i > 50;
  end loop;

  insert into public.landing_pages (
    webinar_id, organization_id, public_slug, headline, subheadline, cta_label, is_published
  ) values (
    new.id, new.organization_id, v_candidate, new.title, null, 'Register now', false
  )
  on conflict (webinar_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_webinar_created_make_landing on public.webinars;
create trigger on_webinar_created_make_landing
  after insert on public.webinars
  for each row execute function public.create_landing_page_for_webinar();
