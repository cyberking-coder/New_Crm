-- WebinarOS — Phase 1 tenancy foundation
-- Introduces organizations, memberships, user profiles, and audit logs with RLS.

create extension if not exists "pgcrypto";

-- =============================================================================
-- user_profiles — one row per auth.users row, created on first sign-in via trigger.
-- =============================================================================
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_self_read"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "user_profiles_self_update"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Backfill a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- organizations — tenant root.
-- =============================================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_created_by_idx on public.organizations(created_by);

alter table public.organizations enable row level security;

-- =============================================================================
-- organization_members — join of auth users to orgs with roles.
-- =============================================================================
do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'manager', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members(user_id);

alter table public.organization_members enable row level security;

-- Helper: is the current user a member of org?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

-- Helper: current user's role in org (null if not a member).
create or replace function public.org_role(org_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_members
  where organization_id = org_id and user_id = auth.uid()
  limit 1;
$$;

-- organizations policies
create policy "organizations_read_members"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "organizations_insert_authenticated"
  on public.organizations for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "organizations_update_admins"
  on public.organizations for update
  using (public.org_role(id) in ('owner', 'admin'))
  with check (public.org_role(id) in ('owner', 'admin'));

create policy "organizations_delete_owner"
  on public.organizations for delete
  using (public.org_role(id) = 'owner');

-- organization_members policies
create policy "members_read_own_orgs"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "members_insert_self_or_admin"
  on public.organization_members for insert
  with check (
    -- Self-add is allowed only via the creation flow (role = owner, no prior rows).
    (user_id = auth.uid() and role = 'owner'
      and not exists (
        select 1 from public.organization_members m
        where m.organization_id = organization_members.organization_id
      ))
    or public.org_role(organization_id) in ('owner', 'admin')
  );

create policy "members_update_admins"
  on public.organization_members for update
  using (public.org_role(organization_id) in ('owner', 'admin'))
  with check (public.org_role(organization_id) in ('owner', 'admin'));

create policy "members_delete_admins_or_self"
  on public.organization_members for delete
  using (
    public.org_role(organization_id) in ('owner', 'admin')
    or user_id = auth.uid()
  );

-- =============================================================================
-- audit_logs — append-only record of significant actions.
-- =============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_created_idx
  on public.audit_logs(organization_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_read_members"
  on public.audit_logs for select
  using (organization_id is not null and public.is_org_member(organization_id));

-- Writes are server-only (service role bypasses RLS). No insert policy for anon/authenticated.

-- =============================================================================
-- updated_at trigger helper
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_profiles on public.user_profiles;
create trigger touch_user_profiles before update on public.user_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_organizations on public.organizations;
create trigger touch_organizations before update on public.organizations
  for each row execute function public.touch_updated_at();
