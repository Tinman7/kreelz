-- KREELZ: more than one admin (per David 2026-11-28). The admin page now asks the database "am I an admin?" instead of
-- comparing with one fixed email. Emails live only in this table in Supabase, never in the (public) repo.
-- Paste into Supabase > SQL Editor > New query, put YOUR email in the last line, Run. Safe to run more than once.

create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;   -- no policies: nobody can read or change it from the site
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
     and lower(coalesce(auth.jwt()->>'email', '')) in (select 'kreelzkorea@gmail.com' union select lower(email) from public.admin_emails)
$$;

create or replace function public.am_i_admin() returns boolean language sql stable as $$ select public.is_admin() $$;
grant execute on function public.am_i_admin() to authenticated;

-- ↓ change to your own email (the one you will type on the admin page), then Run
insert into public.admin_emails (email) values ('YOUR_EMAIL@gmail.com') on conflict do nothing;
