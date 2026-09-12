create or replace function public.leave_reach_request(p_request_id uuid)
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
    raise exception 'Sign in as a student to leave this request';
  end if;

  select * into req
  from public.reach_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'That leave is gone';
  end if;

  if exists (
    select 1
    from public.reach_crossings x
    where x.request_id = req.id
      and x.student_id = sid
  ) then
    raise exception 'You cannot leave after sign-out';
  end if;

  update public.reach_companions
  set
    status = 'declined'::public.reach_companion_status,
    responded_at = now()
  where request_id = req.id
    and student_id = sid
    and status = 'accepted';

  if not found then
    raise exception 'You are not on this leave';
  end if;
end;
$$;

revoke all on function public.leave_reach_request(uuid) from public;
grant execute on function public.leave_reach_request(uuid) to authenticated;
