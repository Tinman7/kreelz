-- KREELZ feedback from visitors (both editions). Paste into Supabase > SQL Editor > New query, then Run.
-- Needs admin.sql first (is_admin). Safe to run more than once.
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null default 'feedback' check (kind in ('feedback','bug','request','other')),
  message    text not null check (char_length(message) between 2 and 2000),
  email      text check (email is null or (char_length(email) <= 120 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  lang       text check (lang is null or char_length(lang) <= 10),
  region     text check (region is null or region in ('global','jp')),
  page       text check (page is null or char_length(page) <= 200),
  visitor    text check (visitor is null or char_length(visitor) between 8 and 40),
  done       boolean not null default false
);
create index if not exists feedback_created on public.feedback (created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "site can send feedback" on public.feedback;
create policy "site can send feedback" on public.feedback for insert to anon, authenticated with check (done = false);
grant insert on public.feedback to anon, authenticated;
-- nobody reads feedback directly; the admin reads it through the functions below

-- spam guard: at most 5 messages a day from one browser, 300 a day in all
create or replace function public.feedback_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visitor is not null and (select count(*) from feedback where visitor = new.visitor and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many messages';
  end if;
  if (select count(*) from feedback where created_at > now() - interval '1 day') >= 300 then
    raise exception 'too many messages';
  end if;
  return new;
end $$;
drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback for each row execute function public.feedback_limit();

-- admin: latest messages, and marking one as handled
create or replace function public.admin_feedback(n int default 100)
returns table(id bigint, created_at timestamptz, kind text, message text, email text, lang text, region text, page text, done boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return query select f.id, f.created_at, f.kind, f.message, f.email, f.lang, f.region, f.page, f.done
    from feedback f order by f.created_at desc limit greatest(1, least(n, 500));
end $$;
create or replace function public.admin_feedback_done(fid bigint, is_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  update feedback set done = is_done where id = fid;
end $$;
revoke all on function public.admin_feedback(int) from public, anon;
revoke all on function public.admin_feedback_done(bigint, boolean) from public, anon;
grant execute on function public.admin_feedback(int) to authenticated;
grant execute on function public.admin_feedback_done(bigint, boolean) to authenticated;
