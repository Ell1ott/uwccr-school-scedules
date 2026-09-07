create type public.cas_status as enum (
  'pending',
  'published',
  'archived',
  'rejected'
);

create type public.cas_session_mode as enum (
  'mandatory',
  'signup',
  'optional'
);

create type public.cas_session_status as enum (
  'published',
  'cancelled'
);

create type public.cas_signup_status as enum (
  'going',
  'waitlisted'
);

create table if not exists public.cas (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  location text not null default '',
  status public.cas_status not null default 'published',
  moderation_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cas_leaders (
  cas_id uuid not null references public.cas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cas_id, profile_id)
);

create table if not exists public.cas_members (
  cas_id uuid not null references public.cas (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (cas_id, student_id)
);

create table if not exists public.cas_session_series (
  id uuid primary key default gen_random_uuid(),
  cas_id uuid not null references public.cas (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  until_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cas_sessions (
  id uuid primary key default gen_random_uuid(),
  cas_id uuid not null references public.cas (id) on delete cascade,
  series_id uuid references public.cas_session_series (id) on delete set null,
  split_group_id uuid,
  label text not null default '',
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.cas_session_mode not null default 'mandatory',
  capacity int check (capacity is null or capacity > 0),
  status public.cas_session_status not null default 'published',
  going_count int not null default 0,
  waitlisted_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cas_sessions_time_order check (ends_at > starts_at)
);

create table if not exists public.cas_session_signups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cas_sessions (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  status public.cas_signup_status not null,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists cas_status_idx on public.cas (status);
create index if not exists cas_moderation_token_idx
  on public.cas (moderation_token)
  where moderation_token is not null;
create index if not exists cas_leaders_profile_idx on public.cas_leaders (profile_id);
create index if not exists cas_members_student_idx on public.cas_members (student_id);
create index if not exists cas_sessions_cas_starts_idx
  on public.cas_sessions (cas_id, starts_at);
create index if not exists cas_sessions_series_idx on public.cas_sessions (series_id);
create index if not exists cas_sessions_split_idx on public.cas_sessions (split_group_id);
create index if not exists cas_session_signups_session_idx
  on public.cas_session_signups (session_id, status);

create or replace function public.is_cas_leader(p_cas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cas_leaders
    where cas_id = p_cas_id
      and profile_id = public.current_profile_id()
  )
$$;

create or replace function public.student_is_cas_member(p_cas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cas_members
    where cas_id = p_cas_id
      and student_id = public.current_student_id()
  )
$$;

create or replace function public.can_see_cas(p_cas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cas c
    where c.id = p_cas_id
      and (
        c.status = 'published'
        or c.created_by = public.current_profile_id()
        or public.is_cas_leader(c.id)
        or public.is_staff()
      )
  )
$$;

create or replace function public.touch_cas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cas_touch_updated_at on public.cas;
create trigger cas_touch_updated_at
before update on public.cas
for each row execute procedure public.touch_cas_updated_at();

drop trigger if exists cas_sessions_touch_updated_at on public.cas_sessions;
create trigger cas_sessions_touch_updated_at
before update on public.cas_sessions
for each row execute procedure public.touch_cas_updated_at();

create or replace function public.refresh_cas_session_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.session_id, old.session_id);
  update public.cas_sessions s
  set
    going_count = (
      select count(*) from public.cas_session_signups r
      where r.session_id = target and r.status = 'going'
    ),
    waitlisted_count = (
      select count(*) from public.cas_session_signups r
      where r.session_id = target and r.status = 'waitlisted'
    )
  where s.id = target;
  return null;
end;
$$;

drop trigger if exists cas_signups_refresh_counts on public.cas_session_signups;
create trigger cas_signups_refresh_counts
after insert or update or delete on public.cas_session_signups
for each row execute procedure public.refresh_cas_session_counts();

create or replace function public.ensure_cas_student_member(
  p_cas_id uuid,
  p_student_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_student_id is null or btrim(p_student_id) = '' then
    return;
  end if;
  insert into public.cas_members (cas_id, student_id)
  values (p_cas_id, p_student_id)
  on conflict do nothing;
end;
$$;

create or replace function public.add_leader_for_student(
  p_cas_id uuid,
  p_student_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if p_student_id is null or btrim(p_student_id) = '' then
    return;
  end if;
  select id into pid
  from public.profiles
  where student_id = p_student_id;
  if pid is null then
    raise exception 'That student does not have an account yet';
  end if;
  insert into public.cas_leaders (cas_id, profile_id)
  values (p_cas_id, pid)
  on conflict do nothing;
  perform public.ensure_cas_student_member(p_cas_id, p_student_id);
end;
$$;

create or replace function public.create_cas(
  p_title text,
  p_description text,
  p_location text,
  p_leader_student_ids text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  student_id text;
  cas_id uuid;
  token text;
  next_status public.cas_status;
  extra text;
begin
  profile_id := public.current_profile_id();
  if profile_id is null then
    raise exception 'No profile';
  end if;
  student_id := public.current_student_id();
  if not public.is_staff() and student_id is null then
    raise exception 'Only staff and students can create a CAS';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Give the CAS a title';
  end if;

  if public.is_staff() then
    next_status := 'published';
    token := null;
  else
    next_status := 'pending';
    token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  end if;

  insert into public.cas (
    created_by, title, description, location, status, moderation_token
  )
  values (
    profile_id,
    trim(p_title),
    coalesce(p_description, ''),
    coalesce(p_location, ''),
    next_status,
    token
  )
  returning id into cas_id;

  insert into public.cas_leaders (cas_id, profile_id)
  values (cas_id, profile_id)
  on conflict do nothing;

  if student_id is not null then
    perform public.ensure_cas_student_member(cas_id, student_id);
  end if;

  if public.is_staff() and p_leader_student_ids is not null then
    foreach extra in array p_leader_student_ids
    loop
      perform public.add_leader_for_student(cas_id, extra);
    end loop;
  end if;

  return jsonb_build_object(
    'cas_id', cas_id,
    'moderation_token', token
  );
end;
$$;

create or replace function public.update_cas(
  p_cas_id uuid,
  p_title text,
  p_description text,
  p_location text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cas_leader(p_cas_id) then
    raise exception 'Only leaders can edit this CAS';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Give the CAS a title';
  end if;
  update public.cas
  set
    title = trim(p_title),
    description = coalesce(p_description, ''),
    location = coalesce(p_location, '')
  where id = p_cas_id
    and status in ('pending', 'published');
  if not found then
    raise exception 'CAS not found';
  end if;
end;
$$;

create or replace function public.archive_cas(p_cas_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cas_leader(p_cas_id) then
    raise exception 'Only leaders can archive this CAS';
  end if;
  update public.cas
  set status = 'archived'
  where id = p_cas_id
    and status in ('pending', 'published');
  if not found then
    raise exception 'CAS not found';
  end if;
end;
$$;

create or replace function public.pending_cas_for_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.cas%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    return '[]'::jsonb;
  end if;
  if not public.is_staff() and public.current_profile_id() is null then
    return '[]'::jsonb;
  end if;
  select * into row
  from public.cas
  where moderation_token = btrim(p_token)
  limit 1;
  if not found then
    return '[]'::jsonb;
  end if;
  if row.created_by <> public.current_profile_id() and not public.is_staff() then
    return '[]'::jsonb;
  end if;
  return jsonb_build_array(
    jsonb_build_object(
      'id', row.id,
      'title', row.title,
      'description', row.description,
      'location', row.location,
      'created_by', row.created_by
    )
  );
end;
$$;

create or replace function public.moderate_cas_by_token(
  p_token text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sample public.cas%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'message', 'This link is missing a token.');
  end if;
  if p_decision not in ('allow', 'deny') then
    return jsonb_build_object('ok', false, 'message', 'Decision must be allow or deny.');
  end if;

  select * into sample
  from public.cas
  where moderation_token = btrim(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'kind', 'missing');
  end if;

  if sample.status = 'published' or sample.status = 'archived' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'kind', 'cas',
      'message', 'This CAS was already allowed.'
    );
  end if;
  if sample.status = 'rejected' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'kind', 'cas',
      'message', 'This CAS was already declined.'
    );
  end if;
  if sample.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'This CAS cannot be moderated.');
  end if;

  if p_decision = 'deny' then
    update public.cas
    set status = 'rejected'
    where id = sample.id and status = 'pending';
    return jsonb_build_object(
      'ok', true,
      'kind', 'cas',
      'message', 'CAS declined.'
    );
  end if;

  update public.cas
  set status = 'published'
  where id = sample.id and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'kind', 'cas',
    'message', 'CAS allowed.'
  );
end;
$$;

create or replace function public.add_cas_leader(
  p_cas_id uuid,
  p_student_id text default null,
  p_teacher_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if not public.is_cas_leader(p_cas_id) then
    raise exception 'Only leaders can add leaders';
  end if;
  if exists (select 1 from public.cas where id = p_cas_id and status = 'archived') then
    raise exception 'This CAS is archived';
  end if;

  if p_student_id is not null and btrim(p_student_id) <> '' then
    perform public.add_leader_for_student(p_cas_id, p_student_id);
    return;
  end if;

  if p_teacher_id is not null and btrim(p_teacher_id) <> '' then
    select id into pid
    from public.profiles
    where teacher_id = p_teacher_id;
    if pid is null then
      raise exception 'That staff member does not have an account yet';
    end if;
    insert into public.cas_leaders (cas_id, profile_id)
    values (p_cas_id, pid)
    on conflict do nothing;
    return;
  end if;

  raise exception 'Pick someone to add as a leader';
end;
$$;

create or replace function public.remove_cas_leader(
  p_cas_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if not public.is_cas_leader(p_cas_id) then
    raise exception 'Only leaders can remove leaders';
  end if;
  select count(*) into remaining
  from public.cas_leaders
  where cas_id = p_cas_id
    and profile_id <> p_profile_id;
  if remaining < 1 then
    raise exception 'A CAS needs at least one leader';
  end if;
  delete from public.cas_leaders
  where cas_id = p_cas_id and profile_id = p_profile_id;
end;
$$;

create or replace function public.join_cas(p_cas_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  row public.cas%rowtype;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to join';
  end if;
  select * into row from public.cas where id = p_cas_id;
  if not found then
    raise exception 'CAS not found';
  end if;
  if row.status <> 'published' then
    raise exception 'This CAS is not open yet';
  end if;
  perform public.ensure_cas_student_member(p_cas_id, sid);
end;
$$;

create or replace function public.leave_cas(p_cas_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to leave';
  end if;
  delete from public.cas_members
  where cas_id = p_cas_id and student_id = sid;
  delete from public.cas_session_signups s
  using public.cas_sessions sess
  where s.session_id = sess.id
    and sess.cas_id = p_cas_id
    and s.student_id = sid
    and sess.starts_at >= now();
end;
$$;

create or replace function public.create_cas_sessions(
  p_cas_id uuid,
  p_label text,
  p_description text,
  p_location text,
  p_starts timestamptz[],
  p_ends timestamptz[],
  p_mode public.cas_session_mode,
  p_capacity int,
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
  session_ids uuid[] := '{}';
  session_id uuid;
  i int;
  cap int;
begin
  if not public.is_cas_leader(p_cas_id) then
    raise exception 'Only leaders can plan sessions';
  end if;
  if not exists (
    select 1 from public.cas where id = p_cas_id and status = 'published'
  ) then
    raise exception 'Sessions can only be added to a published CAS';
  end if;
  profile_id := public.current_profile_id();
  if p_starts is null or p_ends is null or array_length(p_starts, 1) is null then
    raise exception 'At least one session is required';
  end if;
  if array_length(p_starts, 1) <> array_length(p_ends, 1) then
    raise exception 'starts and ends must match';
  end if;

  cap := p_capacity;
  if p_mode <> 'signup' then
    cap := null;
  end if;

  if p_freq = 'weekly' and array_length(p_starts, 1) > 1 then
    insert into public.cas_session_series (cas_id, created_by, until_date)
    values (
      p_cas_id,
      profile_id,
      coalesce(p_until_date, (p_starts[array_length(p_starts, 1)])::date)
    )
    returning id into series;
  end if;

  for i in 1 .. array_length(p_starts, 1) loop
    insert into public.cas_sessions (
      cas_id, series_id, label, description, location,
      starts_at, ends_at, mode, capacity, status
    )
    values (
      p_cas_id,
      series,
      coalesce(p_label, ''),
      coalesce(p_description, ''),
      coalesce(p_location, ''),
      p_starts[i],
      p_ends[i],
      p_mode,
      cap,
      'published'
    )
    returning id into session_id;
    session_ids := session_ids || session_id;
  end loop;

  return session_ids;
end;
$$;

create or replace function public.update_cas_session(
  p_session_id uuid,
  p_label text,
  p_description text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_mode public.cas_session_mode,
  p_capacity int,
  p_rest_of_series boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.cas_sessions%rowtype;
  cap int;
  delta interval;
  n int;
begin
  select * into sess from public.cas_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if not public.is_cas_leader(sess.cas_id) then
    raise exception 'Only leaders can edit sessions';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'End time needs to be after the start';
  end if;

  cap := p_capacity;
  if p_mode <> 'signup' then
    cap := null;
  end if;

  if p_rest_of_series and sess.series_id is not null then
    delta := p_starts_at - sess.starts_at;
    update public.cas_sessions
    set
      label = coalesce(p_label, ''),
      description = coalesce(p_description, ''),
      location = coalesce(p_location, ''),
      starts_at = starts_at + delta,
      ends_at = starts_at + delta + (p_ends_at - p_starts_at),
      mode = p_mode,
      capacity = cap
    where series_id = sess.series_id
      and starts_at >= sess.starts_at
      and status = 'published';
    get diagnostics n = row_count;
  else
    update public.cas_sessions
    set
      label = coalesce(p_label, ''),
      description = coalesce(p_description, ''),
      location = coalesce(p_location, ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      mode = p_mode,
      capacity = cap
    where id = p_session_id;
    n := 1;
  end if;

  if p_mode <> 'signup' then
    delete from public.cas_session_signups s
    using public.cas_sessions sess2
    where s.session_id = sess2.id
      and (
        sess2.id = p_session_id
        or (
          p_rest_of_series
          and sess.series_id is not null
          and sess2.series_id = sess.series_id
          and sess2.starts_at >= sess.starts_at
        )
      );
  end if;

  return n;
end;
$$;

create or replace function public.cancel_cas_session(
  p_session_id uuid,
  p_rest_of_series boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.cas_sessions%rowtype;
  n int;
begin
  select * into sess from public.cas_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if not public.is_cas_leader(sess.cas_id) then
    raise exception 'Only leaders can cancel sessions';
  end if;

  if p_rest_of_series and sess.series_id is not null then
    update public.cas_sessions
    set status = 'cancelled'
    where series_id = sess.series_id
      and starts_at >= sess.starts_at
      and status = 'published';
    get diagnostics n = row_count;
  else
    update public.cas_sessions
    set status = 'cancelled'
    where id = p_session_id
      and status = 'published';
    n := 1;
  end if;
  return n;
end;
$$;

create or replace function public.split_cas_session(
  p_session_id uuid,
  p_starts timestamptz[],
  p_ends timestamptz[],
  p_labels text[] default '{}',
  p_capacity int default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.cas_sessions%rowtype;
  group_id uuid := gen_random_uuid();
  session_ids uuid[] := '{}';
  session_id uuid;
  i int;
  next_label text;
begin
  select * into sess from public.cas_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;
  if not public.is_cas_leader(sess.cas_id) then
    raise exception 'Only leaders can split sessions';
  end if;
  if sess.status <> 'published' then
    raise exception 'This session is cancelled';
  end if;
  if p_starts is null or array_length(p_starts, 1) is null or array_length(p_starts, 1) < 2 then
    raise exception 'Split needs at least two sessions';
  end if;
  if array_length(p_starts, 1) <> array_length(p_ends, 1) then
    raise exception 'starts and ends must match';
  end if;

  update public.cas_sessions
  set status = 'cancelled'
  where id = p_session_id;

  for i in 1 .. array_length(p_starts, 1) loop
    next_label := '';
    if p_labels is not null and array_length(p_labels, 1) >= i then
      next_label := coalesce(p_labels[i], '');
    end if;
    insert into public.cas_sessions (
      cas_id, series_id, split_group_id, label, description, location,
      starts_at, ends_at, mode, capacity, status
    )
    values (
      sess.cas_id,
      null,
      group_id,
      next_label,
      sess.description,
      sess.location,
      p_starts[i],
      p_ends[i],
      'signup',
      p_capacity,
      'published'
    )
    returning id into session_id;
    session_ids := session_ids || session_id;
  end loop;

  return session_ids;
end;
$$;

create or replace function public.promote_cas_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.cas_sessions%rowtype;
  going int;
  next_id uuid;
begin
  select * into sess from public.cas_sessions where id = p_session_id for update;
  if not found then return; end if;
  if sess.mode <> 'signup' or sess.capacity is null then return; end if;

  loop
    select count(*) into going
    from public.cas_session_signups
    where session_id = p_session_id and status = 'going';

    if going >= sess.capacity then
      exit;
    end if;

    select id into next_id
    from public.cas_session_signups
    where session_id = p_session_id and status = 'waitlisted'
    order by created_at asc
    limit 1;

    if next_id is null then
      exit;
    end if;

    update public.cas_session_signups
    set status = 'going'
    where id = next_id;
  end loop;
end;
$$;

create or replace function public.signup_cas_session(p_session_id uuid)
returns public.cas_signup_status
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  sess public.cas_sessions%rowtype;
  existing public.cas_session_signups%rowtype;
  going int;
  next_status public.cas_signup_status;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to sign up';
  end if;

  select * into sess from public.cas_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;
  if sess.status <> 'published' then
    raise exception 'This session is cancelled';
  end if;
  if sess.mode <> 'signup' then
    raise exception 'This session does not take signups';
  end if;
  if not public.student_is_cas_member(sess.cas_id) then
    raise exception 'Join the CAS first';
  end if;

  select * into existing
  from public.cas_session_signups
  where session_id = p_session_id and student_id = sid;
  if found then
    return existing.status;
  end if;

  select count(*) into going
  from public.cas_session_signups
  where session_id = p_session_id and status = 'going';

  if sess.capacity is not null and going >= sess.capacity then
    next_status := 'waitlisted';
  else
    next_status := 'going';
  end if;

  insert into public.cas_session_signups (session_id, student_id, status)
  values (p_session_id, sid, next_status);

  return next_status;
end;
$$;

create or replace function public.cancel_cas_signup(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  sess public.cas_sessions%rowtype;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to cancel a signup';
  end if;
  select * into sess from public.cas_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;
  if sess.mode <> 'signup' then
    raise exception 'This session does not take signups';
  end if;

  delete from public.cas_session_signups
  where session_id = p_session_id and student_id = sid;

  perform public.promote_cas_waitlist(p_session_id);
end;
$$;

alter table public.cas enable row level security;
alter table public.cas_leaders enable row level security;
alter table public.cas_members enable row level security;
alter table public.cas_session_series enable row level security;
alter table public.cas_sessions enable row level security;
alter table public.cas_session_signups enable row level security;

create policy cas_select
on public.cas for select
to authenticated
using (
  status = 'published'
  or created_by = public.current_profile_id()
  or public.is_cas_leader(id)
  or public.is_staff()
);

create policy cas_leaders_select
on public.cas_leaders for select
to authenticated
using (public.can_see_cas(cas_id));

create policy cas_members_select
on public.cas_members for select
to authenticated
using (public.can_see_cas(cas_id));

create policy cas_series_select
on public.cas_session_series for select
to authenticated
using (public.can_see_cas(cas_id));

create policy cas_sessions_select
on public.cas_sessions for select
to authenticated
using (public.can_see_cas(cas_id));

create policy cas_signups_select
on public.cas_session_signups for select
to authenticated
using (
  student_id = public.current_student_id()
  or exists (
    select 1 from public.cas_sessions s
    where s.id = session_id and public.is_cas_leader(s.cas_id)
  )
);

drop policy if exists profiles_select_cas_leaders on public.profiles;
create policy profiles_select_cas_leaders
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.cas_leaders l
    where l.profile_id = profiles.id
      and public.can_see_cas(l.cas_id)
  )
);

grant usage on type public.cas_status to authenticated;
grant usage on type public.cas_session_mode to authenticated;
grant usage on type public.cas_session_status to authenticated;
grant usage on type public.cas_signup_status to authenticated;

grant select on public.cas to authenticated;
grant select on public.cas_leaders to authenticated;
grant select on public.cas_members to authenticated;
grant select on public.cas_session_series to authenticated;
grant select on public.cas_sessions to authenticated;
grant select on public.cas_session_signups to authenticated;

revoke all on function public.is_cas_leader(uuid) from public;
revoke all on function public.student_is_cas_member(uuid) from public;
revoke all on function public.can_see_cas(uuid) from public;
revoke all on function public.ensure_cas_student_member(uuid, text) from public;
revoke all on function public.add_leader_for_student(uuid, text) from public;
revoke all on function public.promote_cas_waitlist(uuid) from public;
revoke all on function public.moderate_cas_by_token(text, text) from public;
revoke all on function public.moderate_cas_by_token(text, text) from anon, authenticated;

grant execute on function public.is_cas_leader(uuid) to authenticated;
grant execute on function public.student_is_cas_member(uuid) to authenticated;
grant execute on function public.can_see_cas(uuid) to authenticated;
grant execute on function public.create_cas(text, text, text, text[]) to authenticated;
grant execute on function public.update_cas(uuid, text, text, text) to authenticated;
grant execute on function public.archive_cas(uuid) to authenticated;
grant execute on function public.pending_cas_for_token(text) to authenticated;
grant execute on function public.moderate_cas_by_token(text, text) to service_role;
grant execute on function public.add_cas_leader(uuid, text, text) to authenticated;
grant execute on function public.remove_cas_leader(uuid, uuid) to authenticated;
grant execute on function public.join_cas(uuid) to authenticated;
grant execute on function public.leave_cas(uuid) to authenticated;
grant execute on function public.create_cas_sessions(uuid, text, text, text, timestamptz[], timestamptz[], public.cas_session_mode, int, text, date) to authenticated;
grant execute on function public.update_cas_session(uuid, text, text, text, timestamptz, timestamptz, public.cas_session_mode, int, boolean) to authenticated;
grant execute on function public.cancel_cas_session(uuid, boolean) to authenticated;
grant execute on function public.split_cas_session(uuid, timestamptz[], timestamptz[], text[], int) to authenticated;
grant execute on function public.signup_cas_session(uuid) to authenticated;
grant execute on function public.cancel_cas_signup(uuid) to authenticated;

alter table public.cas replica identity full;
alter table public.cas_leaders replica identity full;
alter table public.cas_members replica identity full;
alter table public.cas_sessions replica identity full;
alter table public.cas_session_signups replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cas'
  ) then
    alter publication supabase_realtime add table public.cas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cas_leaders'
  ) then
    alter publication supabase_realtime add table public.cas_leaders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cas_members'
  ) then
    alter publication supabase_realtime add table public.cas_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cas_sessions'
  ) then
    alter publication supabase_realtime add table public.cas_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cas_session_signups'
  ) then
    alter publication supabase_realtime add table public.cas_session_signups;
  end if;
end
$$;
