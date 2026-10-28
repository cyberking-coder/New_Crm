-- WebinarOS — Phase 3: provider connections, attendance, engagement, recordings,
-- polls, Q&A, offers, and webhook event dedupe.

-- =============================================================================
-- integration_connections — a configured provider connection for an org.
-- =============================================================================
do $$ begin
  create type public.integration_provider as enum (
    'manual','zoom','livestorm','daily','webinarjam','demio','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.integration_category as enum ('webinar','email','crm','payments');
exception when duplicate_object then null; end $$;

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category public.integration_category not null,
  provider public.integration_provider not null,
  display_name text not null,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,          -- non-secret config (account id, region)
  secrets jsonb not null default '{}'::jsonb,         -- opaque secret envelope; never exposed to the client
  webhook_secret text,                                -- signing secret the provider sends with webhooks
  last_health_at timestamptz,
  last_error text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ic_org_category_provider_name
  on public.integration_connections(organization_id, category, provider, display_name);

alter table public.integration_connections enable row level security;

-- Deliberately omit `secrets` from any client-visible view in Phase 6; for now
-- the client reads this table only in server components with the user client.
create policy "ic_read_members"
  on public.integration_connections for select
  using (public.is_org_member(organization_id));

create policy "ic_write_admins"
  on public.integration_connections for all
  using (public.org_role(organization_id) in ('owner','admin'))
  with check (public.org_role(organization_id) in ('owner','admin'));

drop trigger if exists touch_ic on public.integration_connections;
create trigger touch_ic before update on public.integration_connections
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- attendance_sessions — a single join/leave span by a registrant on a session.
-- =============================================================================
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  registrant_id uuid references public.webinar_registrants(id) on delete set null,
  email text not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  duration_seconds integer,
  provider_participant_id text,
  device text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists attendance_webinar_idx on public.attendance_sessions(webinar_id, joined_at desc);
create index if not exists attendance_org_idx on public.attendance_sessions(organization_id, joined_at desc);
create index if not exists attendance_registrant_idx on public.attendance_sessions(registrant_id);

alter table public.attendance_sessions enable row level security;

create policy "attendance_read_members"
  on public.attendance_sessions for select
  using (public.is_org_member(organization_id));

-- Writes happen server-side (service role) via webhook handlers or manual actions.

-- =============================================================================
-- engagement_events — fine-grained events during a session.
-- =============================================================================
do $$ begin
  create type public.engagement_kind as enum (
    'join','leave','focus','blur','poll_shown','poll_answered',
    'question_asked','handout_downloaded','offer_shown','offer_clicked',
    'chat_message','reaction'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  registrant_id uuid references public.webinar_registrants(id) on delete set null,
  kind public.engagement_kind not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists engagement_webinar_time_idx
  on public.engagement_events(webinar_id, occurred_at desc);
create index if not exists engagement_org_time_idx
  on public.engagement_events(organization_id, occurred_at desc);
create index if not exists engagement_registrant_idx
  on public.engagement_events(registrant_id, occurred_at desc);

alter table public.engagement_events enable row level security;

create policy "engagement_read_members"
  on public.engagement_events for select
  using (public.is_org_member(organization_id));

-- =============================================================================
-- polls + poll_responses
-- =============================================================================
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists polls_webinar_idx on public.polls(webinar_id, created_at desc);

alter table public.polls enable row level security;

create policy "polls_read_members"
  on public.polls for select
  using (public.is_org_member(organization_id));

create policy "polls_write_managers"
  on public.polls for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  poll_id uuid not null references public.polls(id) on delete cascade,
  registrant_id uuid references public.webinar_registrants(id) on delete set null,
  email text,
  option_index integer not null,
  option_text text,
  created_at timestamptz not null default now()
);

create index if not exists poll_responses_poll_idx on public.poll_responses(poll_id);

alter table public.poll_responses enable row level security;

create policy "poll_responses_read_members"
  on public.poll_responses for select
  using (public.is_org_member(organization_id));

-- =============================================================================
-- questions (Q&A)
-- =============================================================================
do $$ begin
  create type public.question_status as enum ('open','answered','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  registrant_id uuid references public.webinar_registrants(id) on delete set null,
  asker_name text,
  asker_email text,
  body text not null,
  status public.question_status not null default 'open',
  answered_body text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  asked_at timestamptz not null default now()
);

create index if not exists questions_webinar_idx on public.questions(webinar_id, asked_at desc);
create index if not exists questions_status_idx on public.questions(organization_id, status);

alter table public.questions enable row level security;

create policy "questions_read_members"
  on public.questions for select
  using (public.is_org_member(organization_id));

create policy "questions_update_managers"
  on public.questions for update
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

-- =============================================================================
-- offers (CTAs shown during the webinar)
-- =============================================================================
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  title text not null,
  url text,
  price_cents integer,
  currency text default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offers_webinar_idx on public.offers(webinar_id, created_at desc);

alter table public.offers enable row level security;

create policy "offers_read_members"
  on public.offers for select
  using (public.is_org_member(organization_id));

create policy "offers_write_managers"
  on public.offers for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_offers on public.offers;
create trigger touch_offers before update on public.offers
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- recordings — references to the recorded video of a session.
-- =============================================================================
do $$ begin
  create type public.recording_source as enum ('provider','upload','external');
exception when duplicate_object then null; end $$;

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  session_id uuid references public.webinar_sessions(id) on delete set null,
  title text not null,
  source public.recording_source not null default 'external',
  external_url text,
  storage_path text,                              -- path inside the 'recordings' Supabase Storage bucket
  duration_seconds integer,
  size_bytes bigint,
  thumbnail_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recordings_webinar_idx on public.recordings(webinar_id, created_at desc);

alter table public.recordings enable row level security;

create policy "recordings_read_members"
  on public.recordings for select
  using (public.is_org_member(organization_id));

create policy "recordings_public_read"
  on public.recordings for select
  using (is_public = true);

create policy "recordings_write_managers"
  on public.recordings for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_recordings on public.recordings;
create trigger touch_recordings before update on public.recordings
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- webhook_events — append-only ledger for idempotency and audit.
-- =============================================================================
do $$ begin
  create type public.webhook_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.webhook_delivery_status as enum ('received','processed','failed','skipped_duplicate');
exception when duplicate_object then null; end $$;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  direction public.webhook_direction not null default 'inbound',
  provider public.integration_provider,
  event_type text,
  external_event_id text,                         -- provider-assigned id for idempotency
  signature text,
  payload jsonb not null default '{}'::jsonb,
  status public.webhook_delivery_status not null default 'received',
  error text,
  attempt integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists webhook_events_dedupe
  on public.webhook_events(connection_id, external_event_id)
  where external_event_id is not null;

create index if not exists webhook_events_org_time_idx
  on public.webhook_events(organization_id, received_at desc);

alter table public.webhook_events enable row level security;

create policy "webhook_events_read_admins"
  on public.webhook_events for select
  using (
    organization_id is not null
    and public.org_role(organization_id) in ('owner','admin')
  );

-- Writes happen only via server-side ingestion using the service role.
