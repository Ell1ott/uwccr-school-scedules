create or replace function public.reach_request_is_locked(
  p_status public.reach_request_status
)
returns boolean
language sql
immutable
as $$
  select p_status in (
    'active'::public.reach_request_status,
    'returned'::public.reach_request_status
  );
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
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object('id', req.id, 'status', next_status);
end;
$$;

create or replace function public.delete_reach_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  sid text;
  req public.reach_requests%rowtype;
begin
  profile_id := public.current_profile_id();
  sid := public.current_student_id();
  if profile_id is null or sid is null then
    raise exception 'Sign in as a student to delete this leave';
  end if;

  select * into req
  from public.reach_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'That leave is gone';
  end if;
  if req.created_by <> profile_id or req.student_id <> sid then
    raise exception 'Only the student who created this leave can delete it';
  end if;
  if public.reach_request_is_locked(req.status)
    or exists (
      select 1
      from public.reach_crossings x
      where x.request_id = req.id
    )
  then
    raise exception 'This leave cannot be deleted after sign-out';
  end if;

  delete from storage.objects
  where bucket_id = 'reach-documents'
    and split_part(name, '/', 1) = req.id::text;

  delete from public.reach_requests
  where id = req.id;
end;
$$;

revoke all on function public.reach_request_is_locked(public.reach_request_status) from public;
revoke all on function public.update_reach_request(
  uuid,
  public.reach_leave_type,
  timestamptz,
  text,
  public.reach_transport_mode[],
  timestamptz,
  text,
  text,
  text,
  text,
  text[]
) from public;
revoke all on function public.delete_reach_request(uuid) from public;

grant execute on function public.reach_request_is_locked(public.reach_request_status) to authenticated;
grant execute on function public.update_reach_request(
  uuid,
  public.reach_leave_type,
  timestamptz,
  text,
  public.reach_transport_mode[],
  timestamptz,
  text,
  text,
  text,
  text,
  text[]
) to authenticated;
grant execute on function public.delete_reach_request(uuid) to authenticated;
