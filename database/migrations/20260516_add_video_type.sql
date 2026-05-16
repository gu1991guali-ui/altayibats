-- Add long/short video layout type to existing Supabase projects.
-- Existing videos are migrated to long by default.

begin;

alter table public.videos
add column if not exists video_type text;

update public.videos
set video_type = 'long'
where video_type is null
   or video_type not in ('long', 'short');

alter table public.videos
alter column video_type set default 'long';

alter table public.videos
alter column video_type set not null;

alter table public.videos
drop constraint if exists videos_video_type_check;

alter table public.videos
add constraint videos_video_type_check
check (video_type in ('long', 'short'));

commit;
