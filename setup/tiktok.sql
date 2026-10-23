-- KREELZ TikTok shorts added by hand from the admin page (/admin).
-- Paste into Supabase > SQL Editor > New query, then Run. Needs setup/admin.sql first (is_admin, kst_today).
-- Each row is one public TikTok video; the nightly refresh puts them into the site's Shorts at 00:00 KST.
create table if not exists public.tiktok_links (
  vid        text primary key check (vid ~ '^[0-9]{8,25}$'),                 -- TikTok video id
  author     text not null check (char_length(author) between 1 and 40),    -- @account, without the @
  title      text not null default '' check (char_length(title) <= 300),
  cat        text not null check (cat in ('m','d','f','e','b','k')),        -- music, drama, film, shows, beauty, K-food
  added      date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now()
);
alter table public.tiktok_links enable row level security;
drop policy if exists "anyone reads tiktok links" on public.tiktok_links;
drop policy if exists "admin adds tiktok links" on public.tiktok_links;
drop policy if exists "admin removes tiktok links" on public.tiktok_links;
-- the list is public (they are public TikTok posts shown on the site); only the admin can add or remove
create policy "anyone reads tiktok links" on public.tiktok_links for select using (true);
create policy "admin adds tiktok links" on public.tiktok_links for insert to authenticated with check (public.is_admin());
create policy "admin removes tiktok links" on public.tiktok_links for delete to authenticated using (public.is_admin());
grant select on public.tiktok_links to anon, authenticated;
grant insert, delete on public.tiktok_links to authenticated;
notify pgrst, 'reload schema';
