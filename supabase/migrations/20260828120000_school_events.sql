create type public.app_role as enum ('student', 'staff');

create type public.event_mode as enum ('mandatory', 'invite', 'open', 'info');

create type public.event_status as enum ('published', 'cancelled');

create type public.target_kind as enum (
  'all_students',
  'cohort',
  'academic_class',
  'student',
  'house'
);

create type public.rsvp_status as enum (
  'pending',
  'going',
  'declined',
  'waitlisted'
);

create type public.rsvp_source as enum ('assigned', 'joined');

create table if not exists public.students (
  id text primary key,
  name text not null,
  cohort text not null check (cohort in ('IB1', 'IB2')),
  email text unique,
  house_id text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.app_role not null,
  email text not null unique,
  display_name text not null,
  student_id text unique references public.students (id) on delete set null,
  teacher_id text unique references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profiles_role_links check (
    (role = 'student' and student_id is not null)
    or (role = 'staff' and student_id is null)
  )
);

create table if not exists public.event_series (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  freq text not null check (freq in ('daily', 'weekly')),
  until_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.event_series (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  mode public.event_mode not null,
  capacity int check (capacity is null or capacity > 0),
  status public.event_status not null default 'published',
  going_count int not null default 0,
  waitlisted_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);

create table if not exists public.event_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind public.target_kind not null,
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists event_targets_unique
  on public.event_targets (event_id, kind, payload);

create table if not exists public.event_audience (
  event_id uuid not null references public.events (id) on delete cascade,
  student_id text not null,
  primary key (event_id, student_id)
);

create table if not exists public.event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  student_id text not null,
  status public.rsvp_status not null,
  source public.rsvp_source not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists event_audience_student_idx on public.event_audience (student_id);
create index if not exists event_responses_event_status_idx
  on public.event_responses (event_id, status);

insert into public.profiles (auth_user_id, role, email, display_name, teacher_id)
select t.auth_user_id, 'staff', t.email, t.name, t.id
from public.teachers t
where t.auth_user_id is not null
  and t.email is not null
  and not exists (
    select 1 from public.profiles p where p.auth_user_id = t.auth_user_id
  );

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role = 'staff'
  )
$$;

create or replace function public.current_student_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select student_id from public.profiles
  where auth_user_id = auth.uid() and role = 'student'
$$;

create or replace function public.student_can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_audience
    where event_id = p_event_id
      and student_id = public.current_student_id()
  )
$$;

create or replace function public.touch_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute procedure public.touch_event_updated_at();

create or replace function public.refresh_event_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.event_id, old.event_id);
  update public.events e
  set
    going_count = (
      select count(*) from public.event_responses r
      where r.event_id = target and r.status = 'going'
    ),
    waitlisted_count = (
      select count(*) from public.event_responses r
      where r.event_id = target and r.status = 'waitlisted'
    )
  where e.id = target;
  return null;
end;
$$;

drop trigger if exists event_responses_refresh_counts on public.event_responses;
create trigger event_responses_refresh_counts
after insert or update or delete on public.event_responses
for each row execute procedure public.refresh_event_counts();

create or replace function public.promote_waitlist(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  next_id uuid;
begin
  select * into ev from public.events where id = p_event_id for update;
  if not found then return; end if;
  if ev.mode <> 'open' or ev.capacity is null then return; end if;

  loop
    select count(*) into ev.going_count
    from public.event_responses
    where event_id = p_event_id and status = 'going';

    if ev.going_count >= ev.capacity then
      exit;
    end if;

    select id into next_id
    from public.event_responses
    where event_id = p_event_id and status = 'waitlisted'
    order by created_at asc
    limit 1;

    if next_id is null then
      exit;
    end if;

    update public.event_responses
    set status = 'going', responded_at = now()
    where id = next_id;
  end loop;
end;
$$;

create or replace function public.create_event_batch(
  p_title text,
  p_description text,
  p_location text,
  p_starts timestamptz[],
  p_ends timestamptz[],
  p_all_day boolean,
  p_mode public.event_mode,
  p_capacity int,
  p_targets jsonb,
  p_audience text[],
  p_freq text default null,
  p_until_date date default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  series uuid;
  event_ids uuid[] := '{}';
  event_id uuid;
  i int;
  target jsonb;
  student text;
  rsvp public.rsvp_status;
begin
  if not public.is_staff() then
    raise exception 'Only staff can create events';
  end if;

  profile_id := public.current_profile_id();
  if profile_id is null then
    raise exception 'No staff profile';
  end if;

  if p_starts is null or p_ends is null or array_length(p_starts, 1) is null then
    raise exception 'At least one occurrence is required';
  end if;
  if array_length(p_starts, 1) <> array_length(p_ends, 1) then
    raise exception 'starts and ends must match';
  end if;
  if p_audience is null or array_length(p_audience, 1) is null then
    raise exception 'Audience cannot be empty';
  end if;
  if p_mode <> 'open' then
    p_capacity := null;
  end if;

  if p_freq in ('daily', 'weekly') and array_length(p_starts, 1) > 1 then
    insert into public.event_series (created_by, freq, until_date)
    values (profile_id, p_freq, coalesce(p_until_date, (p_starts[array_length(p_starts, 1)])::date))
    returning id into series;
  end if;

  for i in 1 .. array_length(p_starts, 1) loop
    insert into public.events (
      series_id, created_by, title, description, location,
      starts_at, ends_at, all_day, mode, capacity, status
    )
    values (
      series, profile_id, trim(p_title), coalesce(p_description, ''),
      coalesce(p_location, ''), p_starts[i], p_ends[i], coalesce(p_all_day, false),
      p_mode, p_capacity, 'published'
    )
    returning id into event_id;

    event_ids := event_ids || event_id;

    if p_targets is not null and jsonb_typeof(p_targets) = 'array' then
      for target in select value from jsonb_array_elements(p_targets)
      loop
        insert into public.event_targets (event_id, kind, payload)
        values (
          event_id,
          (target->>'kind')::public.target_kind,
          coalesce(target->'payload', '{}'::jsonb)
        );
      end loop;
    end if;

    foreach student in array p_audience
    loop
      if student is null or btrim(student) = '' then
        continue;
      end if;
      insert into public.event_audience (event_id, student_id)
      values (event_id, student)
      on conflict do nothing;

      if p_mode = 'mandatory' then
        rsvp := 'going';
      elsif p_mode = 'invite' then
        rsvp := 'pending';
      else
        rsvp := null;
      end if;

      if rsvp is not null then
        insert into public.event_responses (
          event_id, student_id, status, source, responded_at
        )
        values (
          event_id,
          student,
          rsvp,
          'assigned',
          case when rsvp = 'going' then now() else null end
        )
        on conflict (event_id, student_id) do nothing;
      end if;
    end loop;
  end loop;

  return event_ids;
end;
$$;

create or replace function public.join_event(p_event_id uuid)
returns public.rsvp_status
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  ev public.events%rowtype;
  existing public.event_responses%rowtype;
  going int;
  next_status public.rsvp_status;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to join';
  end if;

  select * into ev from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.status <> 'published' then
    raise exception 'This event is cancelled';
  end if;
  if ev.mode <> 'open' then
    raise exception 'This event is not open signup';
  end if;
  if not public.student_can_see_event(p_event_id) then
    raise exception 'You are not eligible for this event';
  end if;

  select * into existing
  from public.event_responses
  where event_id = p_event_id and student_id = sid;

  if found and existing.status in ('going', 'waitlisted') then
    return existing.status;
  end if;

  select count(*) into going
  from public.event_responses
  where event_id = p_event_id and status = 'going';

  if ev.capacity is not null and going >= ev.capacity then
    next_status := 'waitlisted';
  else
    next_status := 'going';
  end if;

  insert into public.event_responses (
    event_id, student_id, status, source, responded_at
  )
  values (p_event_id, sid, next_status, 'joined', now())
  on conflict (event_id, student_id) do update
    set status = excluded.status,
        source = excluded.source,
        responded_at = excluded.responded_at;

  return next_status;
end;
$$;

create or replace function public.leave_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  ev public.events%rowtype;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to leave';
  end if;

  select * into ev from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.mode <> 'open' then
    raise exception 'Leave is only for open events';
  end if;

  delete from public.event_responses
  where event_id = p_event_id and student_id = sid;

  perform public.promote_waitlist(p_event_id);
end;
$$;

create or replace function public.respond_invite(
  p_event_id uuid,
  p_status public.rsvp_status
)
returns public.rsvp_status
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  ev public.events%rowtype;
  existing public.event_responses%rowtype;
begin
  if p_status not in ('going', 'declined') then
    raise exception 'Invite response must be going or declined';
  end if;

  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to RSVP';
  end if;

  select * into ev from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.status <> 'published' then
    raise exception 'This event is cancelled';
  end if;
  if ev.mode <> 'invite' then
    raise exception 'This event is not an invitation';
  end if;

  select * into existing
  from public.event_responses
  where event_id = p_event_id and student_id = sid;

  if not found then
    raise exception 'You were not invited to this event';
  end if;

  update public.event_responses
  set status = p_status, responded_at = now()
  where event_id = p_event_id and student_id = sid;

  return p_status;
end;
$$;

create or replace function public.cancel_event(
  p_event_id uuid,
  p_rest_of_series boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  n int;
begin
  if not public.is_staff() then
    raise exception 'Only staff can cancel events';
  end if;

  select * into ev from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.created_by <> public.current_profile_id() then
    raise exception 'You can only cancel events you created';
  end if;

  if p_rest_of_series and ev.series_id is not null then
    update public.events
    set status = 'cancelled'
    where series_id = ev.series_id
      and starts_at >= ev.starts_at
      and status = 'published';
    get diagnostics n = row_count;
  else
    update public.events
    set status = 'cancelled'
    where id = p_event_id;
    n := 1;
  end if;

  return n;
end;
$$;

alter table public.students enable row level security;
alter table public.profiles enable row level security;
alter table public.event_series enable row level security;
alter table public.events enable row level security;
alter table public.event_targets enable row level security;
alter table public.event_audience enable row level security;
alter table public.event_responses enable row level security;

drop policy if exists students_select on public.students;
create policy students_select
on public.students for select
to authenticated
using (public.is_staff() or id = public.current_student_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles for select
to authenticated
using (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists event_series_select on public.event_series;
create policy event_series_select
on public.event_series for select
to authenticated
using (public.is_staff());

drop policy if exists event_series_insert_own on public.event_series;
create policy event_series_insert_own
on public.event_series for insert
to authenticated
with check (public.is_staff() and created_by = public.current_profile_id());

drop policy if exists events_select on public.events;
create policy events_select
on public.events for select
to authenticated
using (public.is_staff() or public.student_can_see_event(id));

drop policy if exists events_insert_own on public.events;
create policy events_insert_own
on public.events for insert
to authenticated
with check (public.is_staff() and created_by = public.current_profile_id());

drop policy if exists events_update_own on public.events;
create policy events_update_own
on public.events for update
to authenticated
using (public.is_staff() and created_by = public.current_profile_id())
with check (public.is_staff() and created_by = public.current_profile_id());

drop policy if exists event_targets_select on public.event_targets;
create policy event_targets_select
on public.event_targets for select
to authenticated
using (
  public.is_staff()
  or public.student_can_see_event(event_id)
);

drop policy if exists event_targets_insert_own on public.event_targets;
create policy event_targets_insert_own
on public.event_targets for insert
to authenticated
with check (
  public.is_staff()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = public.current_profile_id()
  )
);

drop policy if exists event_audience_select on public.event_audience;
create policy event_audience_select
on public.event_audience for select
to authenticated
using (public.is_staff() or student_id = public.current_student_id());

drop policy if exists event_audience_insert_own on public.event_audience;
create policy event_audience_insert_own
on public.event_audience for insert
to authenticated
with check (
  public.is_staff()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = public.current_profile_id()
  )
);

drop policy if exists event_responses_select on public.event_responses;
create policy event_responses_select
on public.event_responses for select
to authenticated
using (public.is_staff() or student_id = public.current_student_id());

drop policy if exists event_responses_insert_staff on public.event_responses;
create policy event_responses_insert_staff
on public.event_responses for insert
to authenticated
with check (
  public.is_staff()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = public.current_profile_id()
  )
);

drop policy if exists event_responses_update_staff on public.event_responses;
create policy event_responses_update_staff
on public.event_responses for update
to authenticated
using (
  public.is_staff()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = public.current_profile_id()
  )
)
with check (
  public.is_staff()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.created_by = public.current_profile_id()
  )
);

grant usage on type public.app_role to authenticated;
grant usage on type public.event_mode to authenticated;
grant usage on type public.event_status to authenticated;
grant usage on type public.target_kind to authenticated;
grant usage on type public.rsvp_status to authenticated;
grant usage on type public.rsvp_source to authenticated;

grant select on public.students to authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.event_series to authenticated;
grant select, insert, update on public.events to authenticated;
grant select, insert on public.event_targets to authenticated;
grant select, insert on public.event_audience to authenticated;
grant select, insert, update on public.event_responses to authenticated;

revoke all on function public.current_profile_id() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.current_student_id() from public;
revoke all on function public.student_can_see_event(uuid) from public;
revoke all on function public.create_event_batch(text, text, text, timestamptz[], timestamptz[], boolean, public.event_mode, int, jsonb, text[], text, date) from public;
revoke all on function public.join_event(uuid) from public;
revoke all on function public.leave_event(uuid) from public;
revoke all on function public.respond_invite(uuid, public.rsvp_status) from public;
revoke all on function public.cancel_event(uuid, boolean) from public;
revoke all on function public.promote_waitlist(uuid) from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.student_can_see_event(uuid) to authenticated;
grant execute on function public.create_event_batch(text, text, text, timestamptz[], timestamptz[], boolean, public.event_mode, int, jsonb, text[], text, date) to authenticated;
grant execute on function public.join_event(uuid) to authenticated;
grant execute on function public.leave_event(uuid) to authenticated;
grant execute on function public.respond_invite(uuid, public.rsvp_status) to authenticated;
grant execute on function public.cancel_event(uuid, boolean) to authenticated;

alter table public.events replica identity full;
alter table public.event_responses replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_responses'
  ) then
    alter publication supabase_realtime add table public.event_responses;
  end if;
end
$$;
