-- KREELZ: daily push notifications (per David 2026-11-03). Paste into Supabase > SQL Editor > New query, then Run.
-- Needs admin.sql (is_admin). Safe to run more than once.
-- At the end the result shows ONE value, push_token: copy it into the GitHub secret PUSH_TOKEN (it lets the daily
-- sender read the subscriptions; nobody else can). Nothing personal is stored: only the browser's push address and keys.

-- 1) the browsers that turned on the daily alert
create table if not exists public.push_subs (
  endpoint   text primary key check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh     text not null check (char_length(p256dh) between 40 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  edition    text not null default 'en' check (edition in ('en','ja')),
  lang       text check (lang is null or char_length(lang) <= 10),
  created_at timestamptz not null default now(),
  last_sent  timestamptz
);
alter table public.push_subs enable row level security;   -- no policies: only the functions below touch it
revoke all on public.push_subs from anon, authenticated;

-- 2) the site turns the alert on / off for its own browser
create or replace function public.push_sub(e text, k text, a text, ed text default 'en', lg text default null)
returns void language sql security definer set search_path = public as $$
  insert into push_subs (endpoint, p256dh, auth, edition, lang) values (e, k, a, case when ed = 'ja' then 'ja' else 'en' end, left(lg, 10))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, edition = excluded.edition, lang = excluded.lang;
$$;
create or replace function public.push_unsub(e text)
returns void language sql security definer set search_path = public as $$ delete from push_subs where endpoint = e; $$;
grant execute on function public.push_sub(text, text, text, text, text), public.push_unsub(text) to anon, authenticated;

-- 3) the daily sender (GitHub Actions) reads the list with a token only it knows
create table if not exists public.push_token (k text primary key);
alter table public.push_token enable row level security;
revoke all on public.push_token from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;
insert into public.push_token (k) select encode(extensions.gen_random_bytes(24), 'hex') where not exists (select 1 from public.push_token);

create or replace function public.push_targets(tok text, ed text)
returns table(endpoint text, p256dh text, auth text) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from push_token where k = tok) then raise exception 'not allowed'; end if;
  return query select s.endpoint, s.p256dh, s.auth from push_subs s where s.edition = ed;
end $$;
create or replace function public.push_done(tok text, sent text[], gone text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from push_token where k = tok) then raise exception 'not allowed'; end if;
  update push_subs set last_sent = now() where endpoint = any(sent);
  delete from push_subs where endpoint = any(gone);   -- browsers that turned the alert off or were reset
end $$;
grant execute on function public.push_targets(text, text), public.push_done(text, text[], text[]) to anon, authenticated;

-- 4) admin page: how many browsers get the alert
create or replace function public.admin_push_stats()
returns table(edition text, subs bigint, new7 bigint) language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query select p.edition, count(*)::bigint, count(*) filter (where p.created_at > now() - interval '7 days')::bigint
    from push_subs p group by p.edition order by p.edition;
end $$;
grant execute on function public.admin_push_stats() to authenticated;

-- copy this value into the GitHub secret PUSH_TOKEN
select k as push_token from public.push_token;
