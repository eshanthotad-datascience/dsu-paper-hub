-- Enable direct public uploads via Supabase Storage (avoids Google Drive OAuth expiry/verification errors).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', true, 10485760, array['application/pdf', 'image/png'])
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/png'];

drop policy if exists "Anyone can view paper files" on storage.objects;
create policy "Anyone can view paper files"
on storage.objects for select
to public
using (bucket_id = 'papers');

drop policy if exists "Anyone can upload paper files" on storage.objects;
create policy "Anyone can upload paper files"
on storage.objects for insert
to public
with check (bucket_id = 'papers');

grant select, insert on table public.papers to anon, authenticated;

drop policy if exists "Anyone can add papers" on public.papers;
create policy "Anyone can add papers"
on public.papers for insert
to anon, authenticated
with check (true);
