-- KREELZ admin: live numbers for today (KST), read every 30 s by the admin page. Paste into Supabase > SQL Editor, Run.
-- Needs admin.sql and geo.sql first. Safe to run more than once.
create index if not exists events_created on public.events (created_at);

create or replace function public.admin_live()
returns json
language plpgsql security definer set search_path = public as $$
declare
  d date := kst_today();
  r json;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  select json_build_object(
    'now',        now(),
    'visitors',   (select count(distinct visitor) from events where day = d and kind = 'visit'),
    'plays',      (select count(*) from events where day = d and kind = 'play'),
    'ips',        (select count(distinct ip_day) from events where day = d and kind = 'visit' and ip_day is not null),
    'active30',   (select count(distinct visitor) from events where created_at > now() - interval '30 minutes'),
    'plays30',    (select count(*) from events where kind = 'play' and created_at > now() - interval '30 minutes'),
    'likes',      (select count(*) from likes where (created_at at time zone 'Asia/Seoul')::date = d),
    'comments',   (select count(*) from comments where not hidden and (created_at at time zone 'Asia/Seoul')::date = d),
    'hourly',     (select coalesce(json_agg(json_build_object('h', h, 'v', v, 'p', p) order by h), '[]'::json) from (
                     select g.h,
                       (select count(distinct e.visitor) from events e where e.day = d and e.kind = 'visit'
                          and extract(hour from e.created_at at time zone 'Asia/Seoul') = g.h) v,
                       (select count(*) from events e where e.day = d and e.kind = 'play'
                          and extract(hour from e.created_at at time zone 'Asia/Seoul') = g.h) p
                     from generate_series(0, 23) g(h)) x),
    'countries',  (select coalesce(json_agg(json_build_object('c', c, 'v', v, 'p', p) order by v desc, p desc), '[]'::json) from (
                     select coalesce(country, '??') c,
                       count(distinct visitor) filter (where kind = 'visit') v,
                       count(*) filter (where kind = 'play') p
                     from events where day = d group by 1) x),
    'top',        (select coalesce(json_agg(json_build_object('id', video_id, 'n', n) order by n desc), '[]'::json) from (
                     select video_id, count(*) n from events
                     where day = d and kind = 'play' and video_id is not null
                     group by video_id order by 2 desc limit 40) x),
    'recent',     (select coalesce(json_agg(json_build_object('id', video_id, 'c', country, 't', created_at) order by created_at desc), '[]'::json) from (
                     select video_id, country, created_at from events
                     where kind = 'play' and video_id is not null and created_at > now() - interval '30 minutes'
                     order by created_at desc limit 12) x)
  ) into r;
  return r;
end $$;

revoke all on function public.admin_live() from public, anon;
grant execute on function public.admin_live() to authenticated;
