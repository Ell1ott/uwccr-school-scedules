create table if not exists public.teachers (
  id text primary key,
  name text not null,
  email text unique,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cancellations (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.teachers (id) on delete cascade,
  on_date date not null,
  block text not null check (block in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
  subject text,
  reason text,
  start_time text,
  student_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (teacher_id, on_date, block)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;
alter table public.cancellations enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function public.current_teacher_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.teachers where auth_user_id = auth.uid()
$$;

revoke all on function public.current_teacher_id() from public;
grant execute on function public.current_teacher_id() to anon, authenticated;

drop policy if exists cancellations_select_public on public.cancellations;
create policy cancellations_select_public
on public.cancellations for select
to anon, authenticated
using (true);

drop policy if exists cancellations_insert_own on public.cancellations;
create policy cancellations_insert_own
on public.cancellations for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

drop policy if exists cancellations_delete_own on public.cancellations;
create policy cancellations_delete_own
on public.cancellations for delete
to authenticated
using (teacher_id = public.current_teacher_id());

drop policy if exists teachers_select_own on public.teachers;
create policy teachers_select_own
on public.teachers for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists push_select on public.push_subscriptions;
create policy push_select
on public.push_subscriptions for select
to anon, authenticated
using (true);

drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert
on public.push_subscriptions for insert
to anon, authenticated
with check (true);

drop policy if exists push_update on public.push_subscriptions;
create policy push_update
on public.push_subscriptions for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete
on public.push_subscriptions for delete
to anon, authenticated
using (true);

grant select on public.cancellations to anon, authenticated;
grant insert, delete on public.cancellations to authenticated;
grant select on public.teachers to authenticated;
grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;

alter table public.cancellations replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cancellations'
  ) then
    alter publication supabase_realtime add table public.cancellations;
  end if;
end
$$;;
