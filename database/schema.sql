-- Supabase schema for the Arabic video manager.
-- Run this file in Supabase SQL Editor after creating your project.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  video_type text not null default 'long' constraint videos_video_type_check check (video_type in ('long', 'short')),
  video_path text not null,
  thumbnail_path text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_one_per_user unique (video_id, user_id)
);

create index if not exists videos_created_at_idx on public.videos(created_at desc);
create index if not exists comments_video_created_idx on public.comments(video_id, created_at desc);
create index if not exists comments_user_idx on public.comments(user_id);
create index if not exists likes_video_idx on public.likes(video_id);
create index if not exists likes_user_idx on public.likes(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos
for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

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

create or replace function public.guard_user_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.email is distinct from new.email or old.role is distinct from new.role)
     and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change email or role fields';
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_sensitive_fields on public.users;
create trigger users_guard_sensitive_fields
before update on public.users
for each row execute function public.guard_user_sensitive_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.users.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop view if exists public.user_public_profiles;
create view public.user_public_profiles as
select id, display_name, role
from public.users;

revoke all on public.user_public_profiles from public, anon;
grant select on public.user_public_profiles to authenticated;

alter table public.users enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

drop policy if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin
on public.users for select
to authenticated
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists users_insert_own_profile on public.users;
create policy users_insert_own_profile
on public.users for insert
to authenticated
with check (auth.uid() = id and role = 'user');

drop policy if exists users_update_own_profile on public.users;
create policy users_update_own_profile
on public.users for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists users_admin_update on public.users;
create policy users_admin_update
on public.users for update
to authenticated
using (public.is_admin(auth.uid()))
with check (true);

drop policy if exists videos_select_public on public.videos;
create policy videos_select_public
on public.videos for select
to anon, authenticated
using (true);

drop policy if exists videos_insert_admin on public.videos;
create policy videos_insert_admin
on public.videos for insert
to authenticated
with check (public.is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists videos_update_admin on public.videos;
create policy videos_update_admin
on public.videos for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists videos_delete_admin on public.videos;
create policy videos_delete_admin
on public.videos for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists comments_select_authenticated on public.comments;
create policy comments_select_authenticated
on public.comments for select
to authenticated
using (true);

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own
on public.comments for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own
on public.comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists comments_delete_own_or_admin on public.comments;
create policy comments_delete_own_or_admin
on public.comments for delete
to authenticated
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists likes_select_authenticated on public.likes;
create policy likes_select_authenticated
on public.likes for select
to authenticated
using (true);

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own
on public.likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own
on public.likes for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'videos',
    'videos',
    false,
    524288000,
    array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']::text[]
  ),
  (
    'thumbnails',
    'thumbnails',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_read_thumbnails on storage.objects;
create policy storage_read_thumbnails
on storage.objects for select
to anon, authenticated
using (bucket_id = 'thumbnails');

drop policy if exists storage_read_videos_authenticated on storage.objects;
create policy storage_read_videos_authenticated
on storage.objects for select
to authenticated
using (bucket_id = 'videos');

drop policy if exists storage_insert_admin on storage.objects;
create policy storage_insert_admin
on storage.objects for insert
to authenticated
with check (bucket_id in ('videos', 'thumbnails') and public.is_admin(auth.uid()));

drop policy if exists storage_update_admin on storage.objects;
create policy storage_update_admin
on storage.objects for update
to authenticated
using (bucket_id in ('videos', 'thumbnails') and public.is_admin(auth.uid()))
with check (bucket_id in ('videos', 'thumbnails') and public.is_admin(auth.uid()));

drop policy if exists storage_delete_admin on storage.objects;
create policy storage_delete_admin
on storage.objects for delete
to authenticated
using (bucket_id in ('videos', 'thumbnails') and public.is_admin(auth.uid()));

commit;
