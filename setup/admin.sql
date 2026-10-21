-- KREELZ admin statistics. Paste into Supabase > SQL Editor > New query, then Run.
-- 1) anonymous usage events from the site (no personal data: a random id kept in the visitor's browser)
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  day        date not null default ((now() at time zone 'Asia/Seoul')::date),
  kind       text not null check (kind in ('visit','play')),
  visitor    text not null check (char_length(visitor) between 8 and 40),
  video_id   text check (video_id is null or char_length(video_id) between 5 and 120),
  created_at timestamptz not null default now()
);
create index if not exists events_day_kind on public.events (day, kind);
create index if not exists events_video on public.events (video_id) where kind = 'play';
alter table public.events enable row level security;
drop policy if exists "site can record events" on public.events;
create policy "site can record events" on public.events for insert to anon, authenticated
  with check (kind in ('visit','play') and day = ((now() at time zone 'Asia/Seoul')::date));
grant insert on public.events to anon, authenticated;
-- nobody can read events directly; the admin reads totals through the functions below

-- 2) admin check: only the signed-in admin e-mail
create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt()->>'email','') = 'kreelzkorea@gmail.com'
     and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
$$;
create or replace function public.kst_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- daily visitors and plays for the last N finished days (KST)
create or replace function public.admin_daily(n int default 30)
returns table(day date, visitors bigint, plays bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
    select d::date,
      (select count(distinct e.visitor) from events e where e.day = d::date and e.kind = 'visit'),
      (select count(*) from events e where e.day = d::date and e.kind = 'play')
    from generate_series(kst_today() - n, kst_today() - 1, interval '1 day') d
    order by 1;
end $$;

-- totals up to the end of yesterday (KST)
create or replace function public.admin_totals()
returns table(visitors_all bigint, visits_all bigint, plays_all bigint, likes_all bigint, comments_all bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query select
    (select count(distinct visitor) from events where kind = 'visit' and day < kst_today()),
    (select count(*) from events where kind = 'visit' and day < kst_today()),
    (select count(*) from events where kind = 'play' and day < kst_today()),
    (select count(*) from likes where (created_at at time zone 'Asia/Seoul')::date < kst_today()),
    (select count(*) from comments where not hidden and (created_at at time zone 'Asia/Seoul')::date < kst_today());
end $$;

-- top videos: what = 'plays' | 'likes' | 'comments'; period = 'yesterday' | 'all' (all = up to end of yesterday)
create or replace function public.admin_top(what text, period text default 'all', lim int default 10)
returns table(video_id text, n bigint)
language plpgsql security definer set search_path = public as $$
declare d0 date := case when period = 'yesterday' then kst_today() - 1 else date '2000-01-01' end;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  if what = 'plays' then
    return query select e.video_id, count(*) from events e
      where e.kind = 'play' and e.video_id is not null and e.day >= d0 and e.day < kst_today()
      group by e.video_id order by 2 desc limit lim;
  elsif what = 'likes' then
    return query select l.video_id, count(*) from likes l
      where (l.created_at at time zone 'Asia/Seoul')::date >= d0 and (l.created_at at time zone 'Asia/Seoul')::date < kst_today()
      group by l.video_id order by 2 desc limit lim;
  else
    return query select c.video_id, count(*) from comments c
      where not c.hidden and (c.created_at at time zone 'Asia/Seoul')::date >= d0 and (c.created_at at time zone 'Asia/Seoul')::date < kst_today()
      group by c.video_id order by 2 desc limit lim;
  end if;
end $$;

revoke all on function public.admin_daily(int), public.admin_totals(), public.admin_top(text, text, int) from public, anon;
grant execute on function public.admin_daily(int), public.admin_totals(), public.admin_top(text, text, int) to authenticated;
