begin;

alter table public.videos enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_videos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

drop policy if exists videos_select_public on public.videos;
create policy videos_select_public
on public.videos for select
to anon, authenticated
using (true);

drop policy if exists playlists_select_public on public.playlists;
create policy playlists_select_public
on public.playlists for select
to anon, authenticated
using (true);

drop policy if exists playlist_videos_select_public on public.playlist_videos;
create policy playlist_videos_select_public
on public.playlist_videos for select
to anon, authenticated
using (true);

drop policy if exists comments_select_authenticated on public.comments;
drop policy if exists comments_select_public on public.comments;
create policy comments_select_public
on public.comments for select
to anon, authenticated
using (true);

drop policy if exists likes_select_authenticated on public.likes;
drop policy if exists likes_select_public on public.likes;
create policy likes_select_public
on public.likes for select
to anon, authenticated
using (true);

grant select on public.user_public_profiles to anon, authenticated;

update storage.buckets
set public = true
where id = 'videos';

drop policy if exists storage_read_videos_authenticated on storage.objects;
drop policy if exists storage_read_videos_public on storage.objects;
create policy storage_read_videos_public
on storage.objects for select
to anon, authenticated
using (bucket_id = 'videos');

commit;
