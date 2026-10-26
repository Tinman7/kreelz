-- KREELZ: visitors by country + unique IPs per day. Paste into Supabase > SQL Editor > New query, then Run.
-- Safe to run more than once.
--
-- What is stored per visit / play:
--   country  two-letter country code (PH, ID, TH ...). Taken from the network (Cloudflare's country header) when the
--            request carries it, otherwise from the visitor's own browser time zone / language.
--   tz       the browser time zone name (e.g. Asia/Manila), used as a back-up for the country.
--   ip_day   a one-way scrambled code of the IP address that changes every day. It lets the admin page count
--            "unique IPs per day" but the IP address itself is never stored and cannot be recovered from it.

create extension if not exists pgcrypto with schema extensions;

alter table public.events add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
alter table public.events add column if not exists tz text check (tz is null or char_length(tz) <= 40);
alter table public.events add column if not exists ip_day text;
create index if not exists events_day_country on public.events (day, country);

-- secret mixed into the IP code (readable by nobody through the API)
create table if not exists public.kz_secret (k text primary key);
alter table public.kz_secret enable row level security;
revoke all on public.kz_secret from public, anon, authenticated;
insert into public.kz_secret (k) select encode(extensions.gen_random_bytes(24), 'hex') where not exists (select 1 from public.kz_secret);

create or replace function public.events_geo() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  h json;
  ip text;
  cc text;
  s text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := btrim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', h->>'x-forwarded-for', ''), ',', 1));
  cc := upper(coalesce(h->>'cf-ipcountry', ''));
  if cc ~ '^[A-Z]{2}$' and cc not in ('XX', 'T1') then new.country := cc; end if;   -- network country wins
  if new.country is not null and new.country !~ '^[A-Z]{2}$' then new.country := null; end if;
  select k into s from kz_secret limit 1;
  new.ip_day := case when ip <> '' then encode(extensions.digest(ip || '|' || new.day::text || '|' || coalesce(s, ''), 'sha256'), 'hex') end;
  return new;
end $$;

drop trigger if exists events_geo on public.events;
create trigger events_geo before insert on public.events for each row execute function public.events_geo();

-- admin: visitors / unique IPs / plays by country. period = 'yesterday' | '7' | '30' | 'all' (all = up to end of yesterday)
create or replace function public.admin_countries(period text default '30')
returns table(country text, visitors bigint, ips bigint, plays bigint)
language plpgsql security definer set search_path = public as $$
declare d0 date := case period when 'yesterday' then kst_today() - 1 when '7' then kst_today() - 7
                               when '30' then kst_today() - 30 else date '2000-01-01' end;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query
    select coalesce(e.country, '??'),
      count(distinct e.visitor) filter (where e.kind = 'visit'),
      count(distinct (e.day, e.ip_day)) filter (where e.kind = 'visit' and e.ip_day is not null),
      count(*) filter (where e.kind = 'play')
    from events e
    where e.day >= d0 and e.day < kst_today()
    group by 1 order by 2 desc, 4 desc;
end $$;

revoke all on function public.admin_countries(text) from public, anon;
grant execute on function public.admin_countries(text) to authenticated;
