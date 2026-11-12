create table if not exists public.api_rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null check (hit_count > 0),
  primary key (bucket_key, window_start)
);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.api_rate_limit_buckets to service_role;

create index if not exists api_rate_limit_buckets_window_start_idx
  on public.api_rate_limit_buckets (window_start);

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_hit_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 1 or length(p_bucket_key) > 128
     or p_limit is null or p_limit < 1 or p_limit > 100000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limit_buckets as current_bucket (
    bucket_key, window_start, hit_count
  )
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set hit_count = current_bucket.hit_count + 1
  returning hit_count into v_hit_count;

  return query
    select v_hit_count <= p_limit,
           greatest(p_limit - v_hit_count, 0),
           v_reset_at;

  delete from public.api_rate_limit_buckets
  where window_start < v_now - interval '2 days';
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;