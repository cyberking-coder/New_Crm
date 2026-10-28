-- WebinarOS — settings: invitations, API keys.

-- =============================================================================
-- organization_invitations — pending invites keyed by email.
-- When the invitee signs up (same email, verified), accept via /invitations/accept?token=
-- which inserts the membership and marks claimed_at.
-- =============================================================================
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists oi_org_email_open
  on public.organization_invitations(organization_id, lower(email))
  where claimed_at is null;

create index if not exists oi_email_open_idx
  on public.organization_invitations(lower(email))
  where claimed_at is null;

alter table public.organization_invitations enable row level security;

create policy "oi_read_members"
  on public.organization_invitations for select
  using (public.is_org_member(organization_id));

-- Public read of a single invitation by token for the accept flow is handled
-- server-side via the service client; no anon policy needed.

create policy "oi_write_admins"
  on public.organization_invitations for all
  using (public.org_role(organization_id) in ('owner','admin'))
  with check (public.org_role(organization_id) in ('owner','admin'));

-- =============================================================================
-- api_keys — long-lived programmatic credentials per org.
-- key_hash is sha256(hex) of the full secret. The plaintext is shown once
-- at creation and never re-displayed.
-- =============================================================================
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,          -- first 8 chars for identification in listings
  key_hash text not null unique,     -- sha256 of the full key
  scopes jsonb not null default '["read","write"]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_org_idx on public.api_keys(organization_id, created_at desc);

alter table public.api_keys enable row level security;

create policy "api_keys_read_members"
  on public.api_keys for select
  using (public.is_org_member(organization_id));

create policy "api_keys_write_admins"
  on public.api_keys for all
  using (public.org_role(organization_id) in ('owner','admin'))
  with check (public.org_role(organization_id) in ('owner','admin'));
