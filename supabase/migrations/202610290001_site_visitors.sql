-- Records one visit per browser installation. The browser prevents refreshes from
-- increasing the number after its first recorded visit.
create table if not exists public.site_metrics (
  metric_key text primary key,
  total bigint not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);

insert into public.site_metrics (metric_key, total)
values ('visitors', 0)
on conflict (metric_key) do nothing;

create or replace function public.record_site_visit(should_increment boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_total bigint;
begin
  if should_increment then
    update public.site_metrics
    set total = total + 1, updated_at = now()
    where metric_key = 'visitors'
    returning total into current_total;
  else
    select total into current_total from public.site_metrics where metric_key = 'visitors';
  end if;

  return coalesce(current_total, 0);
end;
$$;

grant execute on function public.record_site_visit(boolean) to anon, authenticated;
