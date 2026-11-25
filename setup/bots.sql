-- KREELZ: separate suspected bots from real visitors on the admin page (per David 2026-11-25).
-- Paste into Supabase > SQL Editor > New query, then Run. Needs admin.sql, geo.sql and live.sql first. Safe to run more than once.
-- Nothing is deleted: every visit is still stored. The admin page only counts suspected bots in their own column.
--
-- A visitor counts as "bot suspected" for a day when any of these is true:
--   1. the network says mainland China (YouTube does not play there, so these cannot be real viewers)
--   2. the browser time zone is UTC / GMT / Etc/... (the default on servers, rare on real phones and PCs)
--   3. the browser time zone is China's (Asia/Shanghai ...), whatever country the network shows
--   4. the network says Singapore or Hong Kong (big cloud-server hubs) but the time zone is outside Asia/Oceania
--   5. the browser sent no time zone at all although the network country is known
--   6. 5 or more different "visitors" came from the same IP on the same day (a robot clearing its storage each time)

create or replace function public.kz_bot_row(c text, z text) returns boolean
language sql immutable as $$
  select coalesce((
       coalesce(c, '') = 'CN'
    or (c is not null and coalesce(z, '') = '')
    or coalesce(z, '') ~* '^(utc|gmt|etc/|universal|zulu|greenwich|uct)'
    or coalesce(z, '') in ('Asia/Shanghai', 'Asia/Chongqing', 'Asia/Chungking', 'Asia/Harbin', 'Asia/Urumqi', 'Asia/Kashgar', 'PRC')
    or (coalesce(c, '') in ('SG', 'HK') and coalesce(z, '') !~ '^(Asia|Australia|Pacific)/')
  ), false)
$$;

create or replace function public.kz_bot_visitors(d0 date, d1 date)
returns table(day date, visitor text)
language sql stable security definer set search_path = public as $$
  select e.day, e.visitor from events e
   where e.day between d0 and d1 and kz_bot_row(e.country, e.tz)
  union
  select e.day, e.visitor from events e
    join (select s.day sd, s.ip_day sip from events s
           where s.day between d0 and d1 and s.kind = 'visit' and s.ip_day is not null
           group by s.day, s.ip_day having count(distinct s.visitor) >= 5) h
      on h.sd = e.day and h.sip = e.ip_day
   where e.day between d0 and d1
$$;
revoke all on function public.kz_bot_visitors(date, date) from public, anon, authenticated;

-- daily real visitors / plays and suspected bots for the last N finished days
create or replace function public.admin_daily_real(n int default 30)
returns table(day date, visitors bigint, plays bigint, bots bigint, bot_plays bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
    with b as (select x.day bd, x.visitor bvis from kz_bot_visitors(kst_today() - n, kst_today() - 1) x),
         g as (select gs::date gd from generate_series(kst_today() - n, kst_today() - 1, interval '1 day') gs)
    select g.gd,
      count(distinct e.visitor) filter (where e.kind = 'visit' and b.bvis is null),
      count(e.id) filter (where e.kind = 'play' and b.bvis is null),
      count(distinct e.visitor) filter (where e.kind = 'visit' and b.bvis is not null),
      count(e.id) filter (where e.kind = 'play' and b.bvis is not null)
    from g left join events e on e.day = g.gd
           left join b on b.bd = e.day and b.bvis = e.visitor
    group by g.gd order by g.gd;
end $$;

-- visitors by country without suspected bots (bots in their own columns)
create or replace function public.admin_countries_real(period text default '30')
returns table(country text, visitors bigint, ips bigint, plays bigint, bots bigint, bot_plays bigint)
language plpgsql security definer set search_path = public as $$
declare d0 date := case period when 'yesterday' then kst_today() - 1 when '7' then kst_today() - 7
                               when '30' then kst_today() - 30 else date '2000-01-01' end;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
    with b as (select x.day bd, x.visitor bvis from kz_bot_visitors(d0, kst_today() - 1) x)
    select coalesce(e.country, '??'),
      count(distinct e.visitor) filter (where e.kind = 'visit' and b.bvis is null),
      count(distinct (e.day, e.ip_day)) filter (where e.kind = 'visit' and e.ip_day is not null and b.bvis is null),
      count(e.id) filter (where e.kind = 'play' and b.bvis is null),
      count(distinct e.visitor) filter (where e.kind = 'visit' and b.bvis is not null),
      count(e.id) filter (where e.kind = 'play' and b.bvis is not null)
    from events e left join b on b.bd = e.day and b.bvis = e.visitor
    where e.day >= d0 and e.day < kst_today()
    group by 1 order by 2 desc, 4 desc;
end $$;

-- today's check: which country + browser time zone the visits come from, and how many look like bots
create or replace function public.admin_bot_check()
returns table(country text, tz text, visitors bigint, bots bigint, plays bigint, ips bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
    with b as (select x.visitor bvis from kz_bot_visitors(kst_today(), kst_today()) x)
    select coalesce(e.country, '??'), coalesce(e.tz, '(없음)'),
      count(distinct e.visitor) filter (where e.kind = 'visit'),
      count(distinct e.visitor) filter (where e.kind = 'visit' and b.bvis is not null),
      count(e.id) filter (where e.kind = 'play'),
      count(distinct e.ip_day) filter (where e.kind = 'visit')
    from events e left join b on b.bvis = e.visitor
    where e.day = kst_today()
    group by 1, 2 order by 3 desc, 5 desc limit 40;
end $$;

-- live numbers for today: same as live.sql plus real_* (without suspected bots); hourly, countries and top videos leave bots out
create or replace function public.admin_live()
returns json
language plpgsql security definer set search_path = public as $$
declare
  d date := kst_today();
  bv text[];
  r json;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  bv := array(select x.visitor from kz_bot_visitors(d, d) x);
  select json_build_object(
    'now',        now(),
    'visitors',   (select count(distinct visitor) from events where day = d and kind = 'visit'),
    'plays',      (select count(*) from events where day = d and kind = 'play'),
    'ips',        (select count(distinct ip_day) from events where day = d and kind = 'visit' and ip_day is not null),
    'real_visitors', (select count(distinct visitor) from events where day = d and kind = 'visit' and not (visitor = any(bv))),
    'real_plays',    (select count(*) from events where day = d and kind = 'play' and not (visitor = any(bv))),
    'real_ips',      (select count(distinct ip_day) from events where day = d and kind = 'visit' and ip_day is not null and not (visitor = any(bv))),
    'bots',          (select count(distinct visitor) from events where day = d and kind = 'visit' and visitor = any(bv)),
    'bot_plays',     (select count(*) from events where day = d and kind = 'play' and visitor = any(bv)),
    'active30',   (select count(distinct visitor) from events where created_at > now() - interval '30 minutes' and not (visitor = any(bv))),
    'plays30',    (select count(*) from events where kind = 'play' and created_at > now() - interval '30 minutes' and not (visitor = any(bv))),
    'likes',      (select count(*) from likes where (created_at at time zone 'Asia/Seoul')::date = d),
    'comments',   (select count(*) from comments where not hidden and (created_at at time zone 'Asia/Seoul')::date = d),
    'hourly',     (select coalesce(json_agg(json_build_object('h', h, 'v', v, 'p', p, 'bv', xv) order by h), '[]'::json) from (
                     select g.h,
                       (select count(distinct e.visitor) from events e where e.day = d and e.kind = 'visit' and not (e.visitor = any(bv))
                          and extract(hour from e.created_at at time zone 'Asia/Seoul') = g.h) v,
                       (select count(*) from events e where e.day = d and e.kind = 'play' and not (e.visitor = any(bv))
                          and extract(hour from e.created_at at time zone 'Asia/Seoul') = g.h) p,
                       (select count(distinct e.visitor) from events e where e.day = d and e.kind = 'visit' and e.visitor = any(bv)
                          and extract(hour from e.created_at at time zone 'Asia/Seoul') = g.h) xv
                     from generate_series(0, 23) g(h)) x),
    'countries',  (select coalesce(json_agg(json_build_object('c', c, 'v', v, 'p', p, 'bv', xv, 'bp', xp) order by v desc, p desc), '[]'::json) from (
                     select coalesce(country, '??') c,
                       count(distinct visitor) filter (where kind = 'visit' and not (visitor = any(bv))) v,
                       count(*) filter (where kind = 'play' and not (visitor = any(bv))) p,
                       count(distinct visitor) filter (where kind = 'visit' and visitor = any(bv)) xv,
                       count(*) filter (where kind = 'play' and visitor = any(bv)) xp
                     from events where day = d group by 1) x),
    'top',        (select coalesce(json_agg(json_build_object('id', video_id, 'n', n) order by n desc), '[]'::json) from (
                     select video_id, count(*) n from events
                     where day = d and kind = 'play' and video_id is not null and not (visitor = any(bv))
                     group by video_id order by 2 desc limit 40) x),
    'recent',     (select coalesce(json_agg(json_build_object('id', video_id, 'c', country, 't', created_at) order by created_at desc), '[]'::json) from (
                     select video_id, country, created_at from events
                     where kind = 'play' and video_id is not null and created_at > now() - interval '30 minutes' and not (visitor = any(bv))
                     order by created_at desc limit 12) x)
  ) into r;
  return r;
end $$;

revoke all on function public.admin_daily_real(int), public.admin_countries_real(text), public.admin_bot_check(), public.admin_live() from public, anon;
grant execute on function public.admin_daily_real(int), public.admin_countries_real(text), public.admin_bot_check(), public.admin_live() to authenticated;
