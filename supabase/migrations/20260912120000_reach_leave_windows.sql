create or replace function public.reach_leave_window_error(
  p_leave_type public.reach_leave_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns text
language plpgsql
stable
as $$
declare
  start_local timestamp;
  end_local timestamp;
  start_dow int;
  start_minutes int;
  end_minutes int;
begin
  if p_leave_type in (
    'medical'::public.reach_leave_type,
    'special'::public.reach_leave_type,
    'overnight'::public.reach_leave_type,
    'mayo_2026'::public.reach_leave_type
  ) then
    return null;
  end if;

  start_local := p_starts_at at time zone 'America/Costa_Rica';
  end_local := p_ends_at at time zone 'America/Costa_Rica';
  start_dow := extract(dow from start_local)::int;
  start_minutes := extract(hour from start_local)::int * 60
    + extract(minute from start_local)::int;
  end_minutes := extract(hour from end_local)::int * 60
    + extract(minute from end_local)::int;

  if p_leave_type = 'day'::public.reach_leave_type then
    if start_local::date <> end_local::date then
      return 'Day leave has to be the same day.';
    end if;
    if start_minutes < 6 * 60 or end_minutes > 18 * 60 then
      return 'Day leave is 6 AM to 6 PM.';
    end if;
    return null;
  end if;

  if p_leave_type = 'fri_sat_evening'::public.reach_leave_type then
    if start_dow not in (5, 6) then
      return 'Friday and Saturday evening leave is only those nights.';
    end if;
    if start_local::date <> end_local::date then
      return 'Friday and Saturday evening leave has to be the same night.';
    end if;
    if start_minutes < 18 * 60 or end_minutes > 22 * 60 then
      return 'Friday and Saturday evening leave is 6 PM to 10 PM.';
    end if;
    return null;
  end if;

  if p_leave_type = 'sun_thu_evening'::public.reach_leave_type then
    if start_dow not in (0, 1, 2, 3, 4) then
      return 'Sunday to Thursday evening leave is only those nights.';
    end if;
    if start_local::date <> end_local::date then
      return 'Sunday to Thursday evening leave has to be the same night.';
    end if;
    if start_minutes < 18 * 60 or end_minutes > 20 * 60 then
      return 'Sunday to Thursday evening leave is 6 PM to 8 PM.';
    end if;
    return null;
  end if;

  return null;
end;
$$;

create or replace function public.reach_student_has_overlapping_leave(
  p_student_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_except_request_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reach_requests r
    where r.status in (
      'pending'::public.reach_request_status,
      'approved'::public.reach_request_status,
      'active'::public.reach_request_status
    )
      and r.starts_at < p_ends_at
      and r.ends_at > p_starts_at
      and (p_except_request_id is null or r.id <> p_except_request_id)
      and (
        r.student_id = p_student_id
        or exists (
          select 1
          from public.reach_companions c
          where c.request_id = r.id
            and c.student_id = p_student_id
            and c.status = 'accepted'::public.reach_companion_status
        )
      )
  )
$$;

create or replace function public.create_reach_request(
  p_leave_type public.reach_leave_type,
  p_ends_at timestamptz,
  p_destination text,
  p_transports public.reach_transport_mode[],
  p_starts_at timestamptz default null,
  p_notes text default '',
  p_host_name text default '',
  p_host_phone text default '',
  p_host_address text default '',
  p_companion_student_ids text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  sid text;
  request_id uuid;
  starts_at timestamptz;
  destination text;
  companion_id text;
  transport public.reach_transport_mode;
  window_error text;
  i int;
begin
  profile_id := public.current_profile_id();
  sid := public.current_student_id();
  if profile_id is null or sid is null then
    raise exception 'Sign in as a student to request leave';
  end if;

  destination := btrim(coalesce(p_destination, ''));
  if destination = '' then
    raise exception 'Say where you are going';
  end if;

  if p_transports is null or coalesce(array_length(p_transports, 1), 0) = 0 then
    raise exception 'Pick how you are getting there';
  end if;

  starts_at := coalesce(p_starts_at, now());
  if starts_at < now() - interval '90 seconds' then
    raise exception 'Start time has to be now or later';
  end if;
  if p_ends_at is null or p_ends_at <= starts_at then
    raise exception 'End time has to be after the start';
  end if;
  if p_ends_at < now() - interval '90 seconds' then
    raise exception 'End time has to be now or later';
  end if;

  window_error := public.reach_leave_window_error(p_leave_type, starts_at, p_ends_at);
  if window_error is not null then
    raise exception '%', window_error;
  end if;

  if public.reach_student_has_overlapping_leave(sid, starts_at, p_ends_at, null) then
    raise exception 'You already have leave that overlaps this time';
  end if;

  insert into public.reach_requests (
    created_by,
    student_id,
    leave_type,
    starts_at,
    ends_at,
    destination,
    notes,
    host_name,
    host_phone,
    host_address,
    status
  )
  values (
    profile_id,
    sid,
    p_leave_type,
    starts_at,
    p_ends_at,
    destination,
    coalesce(p_notes, ''),
    coalesce(p_host_name, ''),
    coalesce(p_host_phone, ''),
    coalesce(p_host_address, ''),
    case
      when p_leave_type = 'day' then 'approved'::public.reach_request_status
      else 'pending'::public.reach_request_status
    end
  )
  returning id into request_id;

  for i in 1 .. array_length(p_transports, 1) loop
    transport := p_transports[i];
    insert into public.reach_transports (request_id, sort_order, mode)
    values (request_id, i - 1, transport);
  end loop;

  if p_companion_student_ids is not null then
    foreach companion_id in array p_companion_student_ids loop
      companion_id := btrim(companion_id);
      if companion_id = '' or companion_id = sid then
        continue;
      end if;
      if not exists (select 1 from public.students s where s.id = companion_id) then
        raise exception 'Unknown student in people going';
      end if;
      insert into public.reach_companions (
        request_id,
        student_id,
        invited_by,
        status
      )
      values (request_id, companion_id, sid, 'pending')
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object('id', request_id);
end;
$$;

create or replace function public.update_reach_request(
  p_request_id uuid,
  p_leave_type public.reach_leave_type,
  p_ends_at timestamptz,
  p_destination text,
  p_transports public.reach_transport_mode[],
  p_starts_at timestamptz default null,
  p_notes text default '',
  p_host_name text default '',
  p_host_phone text default '',
  p_host_address text default '',
  p_companion_student_ids text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  sid text;
  req public.reach_requests%rowtype;
  starts_at timestamptz;
  destination text;
  companion_id text;
  transport public.reach_transport_mode;
  next_status public.reach_request_status;
  window_error text;
  i int;
begin
  profile_id := public.current_profile_id();
  sid := public.current_student_id();
  if profile_id is null or sid is null then
    raise exception 'Sign in as a student to change this leave';
  end if;

  select * into req
  from public.reach_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'That leave is gone';
  end if;
  if req.created_by <> profile_id or req.student_id <> sid then
    raise exception 'Only the student who created this leave can change it';
  end if;
  if public.reach_request_is_locked(req.status)
    or exists (
      select 1
      from public.reach_crossings x
      where x.request_id = req.id
    )
  then
    raise exception 'This leave cannot be changed after sign-out';
  end if;

  destination := btrim(coalesce(p_destination, ''));
  if destination = '' then
    raise exception 'Say where you are going';
  end if;

  if p_transports is null or coalesce(array_length(p_transports, 1), 0) = 0 then
    raise exception 'Pick how you are getting there';
  end if;

  starts_at := coalesce(p_starts_at, req.starts_at);
  if date_trunc('minute', starts_at) = date_trunc('minute', req.starts_at) then
    starts_at := req.starts_at;
  elsif starts_at < now() - interval '90 seconds' then
    raise exception 'Start time has to be now or later';
  end if;

  if p_ends_at is null or p_ends_at <= starts_at then
    raise exception 'End time has to be after the start';
  end if;
  if date_trunc('minute', p_ends_at) is distinct from date_trunc('minute', req.ends_at)
    and p_ends_at < now() - interval '90 seconds'
  then
    raise exception 'End time has to be now or later';
  end if;

  window_error := public.reach_leave_window_error(p_leave_type, starts_at, p_ends_at);
  if window_error is not null then
    raise exception '%', window_error;
  end if;

  if public.reach_student_has_overlapping_leave(sid, starts_at, p_ends_at, req.id) then
    raise exception 'You already have leave that overlaps this time';
  end if;

  next_status := case
    when p_leave_type = 'day' then 'approved'::public.reach_request_status
    else 'pending'::public.reach_request_status
  end;

  update public.reach_requests
  set
    leave_type = p_leave_type,
    starts_at = starts_at,
    ends_at = p_ends_at,
    destination = destination,
    notes = coalesce(p_notes, ''),
    host_name = coalesce(p_host_name, ''),
    host_phone = coalesce(p_host_phone, ''),
    host_address = coalesce(p_host_address, ''),
    status = next_status
  where id = req.id;

  delete from public.reach_transports
  where request_id = req.id;

  for i in 1 .. array_length(p_transports, 1) loop
    transport := p_transports[i];
    insert into public.reach_transports (request_id, sort_order, mode)
    values (req.id, i - 1, transport);
  end loop;

  delete from public.reach_companions
  where request_id = req.id
    and student_id <> all(coalesce(p_companion_student_ids, '{}'));

  if p_companion_student_ids is not null then
    foreach companion_id in array p_companion_student_ids loop
      companion_id := btrim(companion_id);
      if companion_id = '' or companion_id = sid then
        continue;
      end if;
      if not exists (select 1 from public.students s where s.id = companion_id) then
        raise exception 'Unknown student in people going';
      end if;
      insert into public.reach_companions (
        request_id,
        student_id,
        invited_by,
        status
      )
      values (req.id, companion_id, sid, 'pending')
      on conflict (request_id, student_id) do update
      set
        status = 'pending'::public.reach_companion_status,
        invited_by = excluded.invited_by,
        responded_at = null
      where public.reach_companions.status = 'declined'::public.reach_companion_status;
    end loop;
  end if;

  return jsonb_build_object('id', req.id, 'status', next_status);
end;
$$;

create or replace function public.respond_reach_invite(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  req public.reach_requests%rowtype;
begin
  sid := public.current_student_id();
  if sid is null then
    raise exception 'Sign in as a student to answer an invite';
  end if;

  select * into req
  from public.reach_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'That invite is no longer waiting';
  end if;
  if req.status in (
    'returned'::public.reach_request_status,
    'denied'::public.reach_request_status,
    'cancelled'::public.reach_request_status
  ) or req.ends_at <= now() then
    raise exception 'That invite is no longer waiting';
  end if;

  if p_accept
    and public.reach_student_has_overlapping_leave(
      sid,
      req.starts_at,
      req.ends_at,
      req.id
    )
  then
    raise exception 'You already have leave that overlaps this time';
  end if;

  update public.reach_companions
  set
    status = case
      when p_accept then 'accepted'::public.reach_companion_status
      else 'declined'::public.reach_companion_status
    end,
    responded_at = now()
  where request_id = p_request_id
    and student_id = sid
    and status = 'pending';

  if not found then
    raise exception 'That invite is no longer waiting';
  end if;
end;
$$;

create or replace function public.guard_checkout(
  p_guard_token text,
  p_student_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_id uuid;
  sid text;
  leave_id uuid;
  leave_open boolean;
  signed text[] := '{}';
  blocked jsonb := '[]'::jsonb;
begin
  session_id := public.guard_require_session(p_guard_token);
  if p_student_ids is null then
    return jsonb_build_object('signed', signed, 'blocked', blocked);
  end if;

  foreach sid in array p_student_ids loop
    sid := btrim(sid);
    if sid = '' then
      continue;
    end if;

    if not exists (
      select 1 from public.students s
      where s.id = sid and s.campus_status = 'on_campus'
    ) then
      blocked := blocked || jsonb_build_array(jsonb_build_object(
        'id', sid,
        'reason', 'already_out'
      ));
      continue;
    end if;

    leave_id := public.student_open_leave_id(sid);
    if leave_id is null then
      blocked := blocked || jsonb_build_array(jsonb_build_object(
        'id', sid,
        'reason', 'no_approved_leave'
      ));
      continue;
    end if;

    select r.starts_at <= now() + interval '10 minutes'
      and r.ends_at > now()
    into leave_open
    from public.reach_requests r
    where r.id = leave_id;

    if not coalesce(leave_open, false) then
      blocked := blocked || jsonb_build_array(jsonb_build_object(
        'id', sid,
        'reason', 'leave_not_started'
      ));
      continue;
    end if;

    update public.students
    set campus_status = 'off_campus'
    where id = sid;

    update public.reach_requests
    set status = 'active'
    where id = leave_id
      and status = 'approved';

    insert into public.reach_crossings (
      student_id,
      request_id,
      session_id,
      direction
    )
    values (sid, leave_id, session_id, 'out');

    signed := array_append(signed, sid);
  end loop;

  return jsonb_build_object('signed', signed, 'blocked', blocked);
end;
$$;

revoke all on function public.reach_leave_window_error(
  public.reach_leave_type,
  timestamptz,
  timestamptz
) from public;
revoke all on function public.reach_student_has_overlapping_leave(
  text,
  timestamptz,
  timestamptz,
  uuid
) from public;
