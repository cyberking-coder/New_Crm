-- WebinarOS — plugin registry.
-- Plugins are first-party or community packages registered in code; a row in
-- `plugins_installed` records that an org has turned one on and holds its
-- config. The runtime loads enabled plugins and runs their hooks.

create table if not exists public.plugins_installed (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plugin_slug text not null,
  version text not null default '1.0.0',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  installed_by uuid references auth.users(id) on delete set null,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plugin_slug)
);

create index if not exists plugins_installed_org_idx
  on public.plugins_installed(organization_id);
create index if not exists plugins_installed_enabled_idx
  on public.plugins_installed(organization_id, enabled);

alter table public.plugins_installed enable row level security;

create policy "plugins_installed_read_members"
  on public.plugins_installed for select
  using (public.is_org_member(organization_id));

create policy "plugins_installed_write_admins"
  on public.plugins_installed for all
  using (public.org_role(organization_id) in ('owner','admin'))
  with check (public.org_role(organization_id) in ('owner','admin'));

drop trigger if exists touch_plugins_installed on public.plugins_installed;
create trigger touch_plugins_installed before update on public.plugins_installed
  for each row execute function public.touch_updated_at();
