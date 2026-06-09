-- إضافة عداد زيارات خفيف للموقع.
-- Run this file once from Supabase SQL Editor.
-- بعد التشغيل، ارجع إلى /admin واضغط "تحديث العداد".

begin;

create extension if not exists pgcrypto;

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text,
  path text not null default '/',
  video_id text,
  page_title text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits(created_at desc);
create index if not exists site_visits_visitor_created_idx on public.site_visits(visitor_id, created_at desc);
create index if not exists site_visits_path_created_idx on public.site_visits(path, created_at desc);

alter table public.site_visits enable row level security;

drop policy if exists site_visits_insert_public on public.site_visits;
create policy site_visits_insert_public
on public.site_visits
for insert
to anon, authenticated
with check (true);

drop policy if exists site_visits_select_admin on public.site_visits;
create policy site_visits_select_admin
on public.site_visits
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists site_visits_delete_admin on public.site_visits;
create policy site_visits_delete_admin
on public.site_visits
for delete
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.get_site_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  analytics jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  select jsonb_build_object(
    'total_page_views', count(*),
    'total_visitors', count(distinct visitor_id),
    'page_views_today', count(*) filter (where created_at >= date_trunc('day', now())),
    'visitors_today', count(distinct visitor_id) filter (where created_at >= date_trunc('day', now())),
    'page_views_7_days', count(*) filter (where created_at >= now() - interval '7 days'),
    'visitors_7_days', count(distinct visitor_id) filter (where created_at >= now() - interval '7 days'),
    'page_views_30_days', count(*) filter (where created_at >= now() - interval '30 days'),
    'visitors_30_days', count(distinct visitor_id) filter (where created_at >= now() - interval '30 days'),
    'top_pages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'path', page_stats.path,
            'page_views', page_stats.page_views,
            'visitors', page_stats.visitors
          )
          order by page_stats.page_views desc, page_stats.path asc
        )
        from (
          select
            path,
            count(*) as page_views,
            count(distinct visitor_id) as visitors
          from public.site_visits
          where created_at >= now() - interval '30 days'
          group by path
          order by page_views desc, path asc
          limit 8
        ) as page_stats
      ),
      '[]'::jsonb
    ),
    'latest_visits', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'path', latest.path,
            'visitor_id', latest.visitor_id,
            'created_at', latest.created_at
          )
          order by latest.created_at desc
        )
        from (
          select path, visitor_id, created_at
          from public.site_visits
          order by created_at desc
          limit 10
        ) as latest
      ),
      '[]'::jsonb
    )
  )
  into analytics
  from public.site_visits;

  return analytics;
end;
$$;

grant execute on function public.get_site_analytics() to authenticated;

notify pgrst, 'reload schema';

commit;
