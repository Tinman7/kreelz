-- KREELZ likes & comments. Paste into Supabase > SQL Editor > New query, then Run.
create table if not exists public.likes (
  video_id   text not null check (char_length(video_id) between 5 and 120),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  video_id   text not null check (char_length(video_id) between 5 and 120),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_video_idx on public.comments (video_id, created_at desc);

alter table public.likes    enable row level security;
alter table public.comments enable row level security;

create policy "anyone reads likes"   on public.likes    for select using (true);
create policy "like as yourself"     on public.likes    for insert to authenticated with check (auth.uid() = user_id);
create policy "unlike your own"      on public.likes    for delete to authenticated using (auth.uid() = user_id);
create policy "anyone reads visible comments" on public.comments for select using (hidden = false);
create policy "comment as yourself"  on public.comments for insert to authenticated
  with check (auth.uid() = user_id and hidden = false and body !~* '(https?://|www\.)');
create policy "delete your own comment" on public.comments for delete to authenticated using (auth.uid() = user_id);

grant select on public.likes, public.comments to anon, authenticated;
grant insert, delete on public.likes, public.comments to authenticated;

-- at most 3 comments per person per minute, 30 per day
create or replace function public.comment_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 3
     or (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'slow down';
  end if;
  return new;
end $$;
drop trigger if exists comment_rate on public.comments;
create trigger comment_rate before insert on public.comments for each row execute function public.comment_rate();
-- To hide a bad comment: Table Editor > comments > set hidden = true (or delete the row).
