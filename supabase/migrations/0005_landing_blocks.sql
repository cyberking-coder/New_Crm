-- WebinarOS — landing page block builder.
-- A landing page is a published header + a row of ordered blocks. Each block
-- stores its own typed content in `data` (jsonb). New block types ship as new
-- renderers; the schema does not change.

do $$ begin
  create type public.landing_block_kind as enum (
    'hero',
    'rich_text',
    'bullets',
    'video',
    'countdown',
    'logos',
    'testimonial',
    'faq',
    'cta',
    'image',
    'form_anchor'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.landing_page_blocks (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.landing_block_kind not null,
  position integer not null,
  data jsonb not null default '{}'::jsonb,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lpb_position_unique
  on public.landing_page_blocks(landing_page_id, position);
create index if not exists lpb_landing_idx
  on public.landing_page_blocks(landing_page_id, position);

alter table public.landing_page_blocks enable row level security;

create policy "lpb_public_read_published"
  on public.landing_page_blocks for select
  using (
    not is_hidden
    and exists (
      select 1 from public.landing_pages lp
      where lp.id = landing_page_id and lp.is_published = true
    )
  );

create policy "lpb_members_read"
  on public.landing_page_blocks for select
  using (public.is_org_member(organization_id));

create policy "lpb_write_managers"
  on public.landing_page_blocks for all
  using (public.org_role(organization_id) in ('owner','admin','manager'))
  with check (public.org_role(organization_id) in ('owner','admin','manager'));

drop trigger if exists touch_lpb on public.landing_page_blocks;
create trigger touch_lpb before update on public.landing_page_blocks
  for each row execute function public.touch_updated_at();
