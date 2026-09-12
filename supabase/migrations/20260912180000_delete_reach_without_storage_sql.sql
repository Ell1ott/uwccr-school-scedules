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

  delete from public.reach_requests
  where id = req.id;
end;
$$;
