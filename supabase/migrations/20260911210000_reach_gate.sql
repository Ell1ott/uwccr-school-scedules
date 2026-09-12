create extension if not exists pgcrypto with schema extensions;

create type public.campus_status as enum ('on_campus', 'off_campus');
create type public.reach_crossing_direction as enum ('out', 'in');

alter type public.reach_request_status add value if not exists 'active';
alter type public.reach_request_status add value if not exists 'returned';

alter table public.students
  add column if not exists campus_status public.campus_status not null default 'on_campus';

create table if not exists public.guard_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.reach_crossings (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  request_id uuid not null references public.reach_requests (id) on delete cascade,
  session_id uuid references public.guard_sessions (id) on delete set null,
  direction public.reach_crossing_direction not null,
  at timestamptz not null default now()
);

create index if not exists students_campus_status_idx
  on public.students (campus_status);
create index if not exists guard_sessions_expires_idx
  on public.guard_sessions (expires_at);
create index if not exists reach_crossings_student_idx
  on public.reach_crossings (student_id, at desc);
create index if not exists reach_crossings_request_idx
  on public.reach_crossings (request_id, at desc);

alter table public.guard_sessions enable row level security;
alter table public.reach_crossings enable row level security;

create policy reach_crossings_staff_select
on public.reach_crossings for select
to authenticated
using (public.is_staff());

grant usage on type public.campus_status to anon, authenticated;
grant usage on type public.reach_crossing_direction to anon, authenticated;

grant select on public.reach_crossings to authenticated;

alter table public.reach_crossings replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reach_crossings'
  ) then
    alter publication supabase_realtime add table public.reach_crossings;
  end if;
end
$$;
