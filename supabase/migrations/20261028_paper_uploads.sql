-- Run this once in Supabase Dashboard -> SQL Editor.
-- Files remain in Google Drive. Supabase stores only searchable paper information.

create extension if not exists pgcrypto;

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_code text,
  branch text not null,
  cycle text check (cycle in ('Chemistry cycle', 'Physics cycle')),
  semester integer not null check (semester between 1 and 12),
  exam_year integer not null check (exam_year between 2000 and 2100),
  exam_type text not null,
  file_name text,
  file_type text,
  file_size bigint check (file_size > 0),
  upload_batch_id uuid,
  drive_file_id text,
  drive_url text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint paper_has_a_drive_link check (drive_url is not null)
);

alter table public.papers add column if not exists cycle text;
alter table public.papers add column if not exists file_name text;
alter table public.papers add column if not exists file_type text;
alter table public.papers add column if not exists file_size bigint;
alter table public.papers add column if not exists upload_batch_id uuid;
alter table public.papers alter column subject_code drop not null;
alter table public.papers alter column drive_file_id drop not null;
alter table public.papers alter column drive_url drop not null;

alter table public.papers enable row level security;
drop policy if exists "Public can read papers" on public.papers;
drop policy if exists "Anyone can read papers" on public.papers;
drop policy if exists "Signed-in users can add papers" on public.papers;
create policy "Anyone can read papers" on public.papers for select using (true);
create policy "Signed-in users can add papers" on public.papers for insert to authenticated with check (uploaded_by = auth.uid());

