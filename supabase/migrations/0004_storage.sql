-- WebinarOS — Phase 3 storage: a 'recordings' bucket; access via server-signed URLs.
-- Public reads are refused by default; grant per-object via a short-lived signed URL
-- generated server-side when the viewer is authorized.

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- Allow authenticated users to read objects whose first path segment matches an
-- org they are a member of. Convention: storage_path = '<organization_id>/<webinar_id>/<file>'.
drop policy if exists "recordings_read_members" on storage.objects;
create policy "recordings_read_members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and public.is_org_member((split_part(name, '/', 1))::uuid)
  );

-- Managers can upload / update / delete.
drop policy if exists "recordings_write_managers" on storage.objects;
create policy "recordings_write_managers"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'recordings'
    and public.org_role((split_part(name, '/', 1))::uuid) in ('owner','admin','manager')
  )
  with check (
    bucket_id = 'recordings'
    and public.org_role((split_part(name, '/', 1))::uuid) in ('owner','admin','manager')
  );
