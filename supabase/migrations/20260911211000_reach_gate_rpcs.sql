create or replace function public.guard_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex')
$$;

create or replace function public.guard_require_session(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_id uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Gate session expired';
  end if;

  update public.guard_sessions
  set last_seen_at = now()
  where token_hash = public.guard_token_hash(p_token)
    and expires_at > now()
  returning id into session_id;

  if session_id is null then
    raise exception 'Gate session expired';
  end if;
  return session_id;
end;
$$;

create or replace function public.student_open_leave_id(p_student_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.reach_requests r
  where r.status in ('approved', 'active')
    and r.ends_at > now()
    and (
      r.student_id = p_student_id
      or exists (
        select 1
        from public.reach_companions c
        where c.request_id = r.id
          and c.student_id = p_student_id
          and c.status = 'accepted'
      )
    )
  order by r.starts_at
  limit 1
$$;

create or replace function public.reach_party_json(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object('id', party.id, 'name', party.name) order by party.name)
      from (
        select s.id, s.name
        from public.reach_requests r
        join public.students s on s.id = r.student_id
        where r.id = p_request_id
        union
        select s.id, s.name
        from public.reach_companions c
        join public.students s on s.id = c.student_id
        where c.request_id = p_request_id
          and c.status = 'accepted'
      ) party
    ),
    '[]'::jsonb
  )
$$;

create or replace function public.reach_leave_json(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'request_id', r.id,
    'leave_type', r.leave_type,
    'destination', r.destination,
    'starts_at', r.starts_at,
    'ends_at', r.ends_at,
    'status', r.status,
    'party', public.reach_party_json(r.id)
  )
  from public.reach_requests r
  where r.id = p_request_id
$$;

create or replace function public.guard_roster(p_guard_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.guard_require_session(p_guard_token);
  return coalesce(
    (
      select jsonb_agg(row_data order by row_data ->> 'name')
      from (
        select jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'cohort', s.cohort,
          'campus_status', s.campus_status,
          'leave', case
            when public.student_open_leave_id(s.id) is null then null
            else public.reach_leave_json(public.student_open_leave_id(s.id))
          end
        ) as row_data
        from public.students s
      ) rows
    ),
    '[]'::jsonb
  );
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

create or replace function public.guard_checkin(
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
  still_out int;
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
      where s.id = sid and s.campus_status = 'off_campus'
    ) then
      blocked := blocked || jsonb_build_array(jsonb_build_object(
        'id', sid,
        'reason', 'already_in'
      ));
      continue;
    end if;

    select c.request_id into leave_id
    from public.reach_crossings c
    where c.student_id = sid
      and c.direction = 'out'
    order by c.at desc
    limit 1;

    if leave_id is null then
      leave_id := public.student_open_leave_id(sid);
    end if;
    if leave_id is null then
      blocked := blocked || jsonb_build_array(jsonb_build_object(
        'id', sid,
        'reason', 'no_crossing'
      ));
      continue;
    end if;

    update public.students
    set campus_status = 'on_campus'
    where id = sid;

    insert into public.reach_crossings (
      student_id,
      request_id,
      session_id,
      direction
    )
    values (sid, leave_id, session_id, 'in');

    select count(*) into still_out
    from public.reach_crossings o
    where o.request_id = leave_id
      and o.direction = 'out'
      and not exists (
        select 1
        from public.reach_crossings i
        where i.request_id = leave_id
          and i.student_id = o.student_id
          and i.direction = 'in'
          and i.at > o.at
      );

    if still_out = 0 then
      update public.reach_requests
      set status = 'returned'
      where id = leave_id
        and status = 'active';
    end if;

    signed := array_append(signed, sid);
  end loop;

  return jsonb_build_object('signed', signed, 'blocked', blocked);
end;
$$;

revoke all on function public.guard_token_hash(text) from public;
revoke all on function public.guard_require_session(text) from public;
revoke all on function public.student_open_leave_id(text) from public;
revoke all on function public.reach_party_json(uuid) from public;
revoke all on function public.reach_leave_json(uuid) from public;

grant execute on function public.guard_roster(text) to anon, authenticated;
grant execute on function public.guard_checkout(text, text[]) to anon, authenticated;
grant execute on function public.guard_checkin(text, text[]) to anon, authenticated;
