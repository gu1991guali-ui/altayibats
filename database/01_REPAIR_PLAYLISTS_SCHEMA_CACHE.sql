-- إصلاح شامل لقوائم التشغيل في Supabase.
-- شغّل هذا الملف مرة واحدة من SQL Editor.
-- يعالج خطأ:
-- Could not find the 'created_by' column of 'playlists' in the schema cache

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users
    where id = check_user_id
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

-- أعمدة إضافية يحتاجها عرض الفيديوهات والقوائم.
alter table public.videos
  add column if not exists category text,
  add column if not exists subtitle_url text,
  add column if not exists captions jsonb,
  add column if not exists translations jsonb;

-- إنشاء الجدول لو لم يكن موجودا.
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- إصلاح الجداول الموجودة سابقا؛ لأن create table if not exists لا يضيف الأعمدة الناقصة.
alter table public.playlists
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.playlists
set title = 'قائمة تشغيل'
where title is null or btrim(title) = '';

alter table public.playlists
  alter column title set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlists_created_by_fkey'
      and conrelid = 'public.playlists'::regclass
  ) then
    alter table public.playlists
      add constraint playlists_created_by_fkey
      foreign key (created_by)
      references public.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlists_title_length_check'
      and conrelid = 'public.playlists'::regclass
  ) then
    alter table public.playlists
      add constraint playlists_title_length_check
      check (char_length(trim(title)) between 1 and 180);
  end if;
end $$;

create table if not exists public.playlist_videos (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid,
  video_id uuid,
  position integer not null default 1 check (position > 0),
  created_at timestamptz not null default now()
);

alter table public.playlist_videos
  add column if not exists playlist_id uuid,
  add column if not exists video_id uuid,
  add column if not exists position integer not null default 1,
  add column if not exists created_at timestamptz not null default now();

update public.playlist_videos
set position = 1
where position is null or position < 1;

alter table public.playlist_videos
  alter column position set default 1,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlist_videos_playlist_id_fkey'
      and conrelid = 'public.playlist_videos'::regclass
  ) then
    alter table public.playlist_videos
      add constraint playlist_videos_playlist_id_fkey
      foreign key (playlist_id)
      references public.playlists(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlist_videos_video_id_fkey'
      and conrelid = 'public.playlist_videos'::regclass
  ) then
    alter table public.playlist_videos
      add constraint playlist_videos_video_id_fkey
      foreign key (video_id)
      references public.videos(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlist_videos_one_video_per_playlist'
      and conrelid = 'public.playlist_videos'::regclass
  ) then
    alter table public.playlist_videos
      add constraint playlist_videos_one_video_per_playlist
      unique (playlist_id, video_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlist_videos_position_check'
      and conrelid = 'public.playlist_videos'::regclass
  ) then
    alter table public.playlist_videos
      add constraint playlist_videos_position_check
      check (position > 0);
  end if;
end $$;

create index if not exists playlists_created_at_idx on public.playlists(created_at desc);
create index if not exists playlist_videos_playlist_position_idx on public.playlist_videos(playlist_id, position);
create index if not exists playlist_videos_video_idx on public.playlist_videos(video_id);

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function public.set_updated_at();

alter table public.playlists enable row level security;
alter table public.playlist_videos enable row level security;

-- سياسات قوائم التشغيل: القراءة عامة، والتعديل للإدارة فقط.
drop policy if exists "Allow public read access on playlists" on public.playlists;
drop policy if exists "Allow full access to authenticated users" on public.playlists;
drop policy if exists "Allow admin full access on playlists" on public.playlists;
drop policy if exists playlists_select_public on public.playlists;
drop policy if exists playlists_insert_admin on public.playlists;
drop policy if exists playlists_update_admin on public.playlists;
drop policy if exists playlists_delete_admin on public.playlists;

create policy playlists_select_public
on public.playlists for select
to anon, authenticated
using (true);

create policy playlists_insert_admin
on public.playlists for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy playlists_update_admin
on public.playlists for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy playlists_delete_admin
on public.playlists for delete
to authenticated
using (public.is_admin(auth.uid()));

-- سياسات عناصر القوائم.
drop policy if exists "Allow public read access on playlist_videos" on public.playlist_videos;
drop policy if exists "Allow full access to authenticated users" on public.playlist_videos;
drop policy if exists "Allow admin full access on playlist_videos" on public.playlist_videos;
drop policy if exists playlist_videos_select_public on public.playlist_videos;
drop policy if exists playlist_videos_insert_admin on public.playlist_videos;
drop policy if exists playlist_videos_update_admin on public.playlist_videos;
drop policy if exists playlist_videos_delete_admin on public.playlist_videos;

create policy playlist_videos_select_public
on public.playlist_videos for select
to anon, authenticated
using (true);

create policy playlist_videos_insert_admin
on public.playlist_videos for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy playlist_videos_update_admin
on public.playlist_videos for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy playlist_videos_delete_admin
on public.playlist_videos for delete
to authenticated
using (public.is_admin(auth.uid()));

commit;

-- تحديث ذاكرة مخطط PostgREST حتى يرى الأعمدة الجديدة مباشرة.
notify pgrst, 'reload schema';
