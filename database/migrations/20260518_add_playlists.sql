begin;

alter table public.videos
  add column if not exists category text,
  add column if not exists subtitle_url text,
  add column if not exists captions jsonb,
  add column if not exists translations jsonb;

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  category text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_videos (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  constraint playlist_videos_one_video_per_playlist unique (playlist_id, video_id)
);

create index if not exists playlists_created_at_idx on public.playlists(created_at desc);
create index if not exists playlist_videos_playlist_position_idx on public.playlist_videos(playlist_id, position);
create index if not exists playlist_videos_video_idx on public.playlist_videos(video_id);

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function public.set_updated_at();

alter table public.playlists enable row level security;
alter table public.playlist_videos enable row level security;

drop policy if exists "Allow public read access on playlists" on public.playlists;
drop policy if exists "Allow full access to authenticated users" on public.playlists;
drop policy if exists "Allow admin full access on playlists" on public.playlists;
drop policy if exists playlists_select_public on public.playlists;
create policy playlists_select_public
on public.playlists for select
to anon, authenticated
using (true);

drop policy if exists "Allow full access to authenticated users" on public.playlists;
drop policy if exists "Allow admin full access on playlists" on public.playlists;
drop policy if exists playlists_insert_admin on public.playlists;
create policy playlists_insert_admin
on public.playlists for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists playlists_update_admin on public.playlists;
create policy playlists_update_admin
on public.playlists for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists playlists_delete_admin on public.playlists;
create policy playlists_delete_admin
on public.playlists for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Allow public read access on playlist_videos" on public.playlist_videos;
drop policy if exists "Allow full access to authenticated users" on public.playlist_videos;
drop policy if exists "Allow admin full access on playlist_videos" on public.playlist_videos;
drop policy if exists playlist_videos_select_public on public.playlist_videos;
create policy playlist_videos_select_public
on public.playlist_videos for select
to anon, authenticated
using (true);

drop policy if exists "Allow full access to authenticated users" on public.playlist_videos;
drop policy if exists "Allow admin full access on playlist_videos" on public.playlist_videos;
drop policy if exists playlist_videos_insert_admin on public.playlist_videos;
create policy playlist_videos_insert_admin
on public.playlist_videos for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists playlist_videos_update_admin on public.playlist_videos;
create policy playlist_videos_update_admin
on public.playlist_videos for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists playlist_videos_delete_admin on public.playlist_videos;
create policy playlist_videos_delete_admin
on public.playlist_videos for delete
to authenticated
using (public.is_admin(auth.uid()));

commit;
