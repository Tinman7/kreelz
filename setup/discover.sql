-- KREELZ: return visits + "new to me?" answers on the 3-minute digest (per David 2026-10-30, the 4-week test).
-- Paste into Supabase > SQL Editor > New query, then Run. Needs admin.sql (and geo.sql for the country column).
-- Safe to run more than once. Nothing personal is stored: the same random browser id the site already uses.

-- 1) answers on the digest pages: was this clip new to the visitor? (one answer per visitor and clip)
create table if not exists public.reactions (
  id         bigint generated always as identity primary key,
  day        date not null default ((now() at time zone 'Asia/Seoul')::date),
  visitor    text not null check (char_length(visitor) between 8 and 40),
  video_id   text not null check (char_length(video_id) between 5 and 40),
  answer     text not null check (answer in ('new','known')),
  edition    text not null default 'en' check (edition in ('en','ja')),
  digest_day date,
  created_at timestamptz not null default now(),
  unique (visitor, video_id)
);
alter table public.reactions enable row level security;
drop policy if exists "site can record reactions" on public.reactions;
create policy "site can record reactions" on public.reactions for insert to anon, authenticated
  with check (day = ((now() at time zone 'Asia/Seoul')::date));
grant insert on public.reactions to anon, authenticated;
-- nobody can read it directly; the admin reads totals through admin_discover()

-- 2) admin: return visits per day (last n finished days, KST)
--    visitors      browsers that visited that day
--    new_visitors  of those, browsers seen for the first time that day
--    repeat_visitors of those, browsers that had visited on an earlier day
--    back7         of that day's new browsers, how many came back within the next 7 days (null until 7 days have passed)
--    cc            optional country filter, e.g. 'JP' (null = all countries)
create or replace function public.admin_retention(n int default 28, cc text default null)
returns table(day date, visitors bigint, new_visitors bigint, repeat_visitors bigint, back7 bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
  with v as (select distinct e.day, e.visitor from events e
             where e.kind = 'visit' and e.day < kst_today() and (cc is null or e.country = upper(cc))),
       f as (select visitor, min(v.day) as first_day from v group by visitor)
  select d.day,
         count(*)::bigint,
         count(*) filter (where f.first_day = d.day)::bigint,
         count(*) filter (where f.first_day < d.day)::bigint,
         case when d.day + 7 < kst_today() then
           (select count(*) from f f2 where f2.first_day = d.day
              and exists (select 1 from v v2 where v2.visitor = f2.visitor and v2.day > d.day and v2.day <= d.day + 7))::bigint
         end
  from v d join f on f.visitor = d.visitor
  where d.day >= kst_today() - n
  group by d.day order by d.day desc;
end $$;

-- 3) admin: "new to me" answers per digest clip (last n days)
create or replace function public.admin_discover(n int default 28)
returns table(video_id text, edition text, new_count bigint, known_count bigint, last_day date)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query select r.video_id, r.edition,
    count(*) filter (where r.answer = 'new')::bigint, count(*) filter (where r.answer = 'known')::bigint, max(r.day)
  from reactions r where r.day >= kst_today() - n
  group by r.video_id, r.edition order by max(r.day) desc, count(*) desc;
end $$;

grant execute on function public.admin_retention(int, text), public.admin_discover(int) to authenticated;
