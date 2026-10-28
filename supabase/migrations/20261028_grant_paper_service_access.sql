-- The upload Edge Function uses the service role to write paper metadata.
grant select, insert, update, delete on table public.papers to service_role;

