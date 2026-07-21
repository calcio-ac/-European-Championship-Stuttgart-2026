-- Run once in the Supabase SQL Editor. Creates a public "media" bucket for
-- Info-page images and PDFs. Anyone can view; only signed-in admins can upload.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media"  on storage.objects;
drop policy if exists "admin write media"  on storage.objects;
drop policy if exists "admin update media" on storage.objects;
drop policy if exists "admin delete media" on storage.objects;

create policy "public read media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "admin write media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.admin_users where user_id = auth.uid()));
