-- Leadership is membership. A CAS leader is always a member: student
-- leaders get a cas_members row, and student_is_cas_member treats leaders
-- as members even when they have no student_id (staff).

create or replace function public.cas_leader_ensures_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  select student_id into sid
  from public.profiles
  where id = new.profile_id;
  if sid is not null and btrim(sid) <> '' then
    perform public.ensure_cas_student_member(new.cas_id, sid);
  end if;
  return new;
end;
$$;

drop trigger if exists cas_leaders_ensure_member on public.cas_leaders;
create trigger cas_leaders_ensure_member
after insert on public.cas_leaders
for each row execute procedure public.cas_leader_ensures_member();

insert into public.cas_members (cas_id, student_id)
select l.cas_id, p.student_id
from public.cas_leaders l
join public.profiles p on p.id = l.profile_id
where p.student_id is not null
  and btrim(p.student_id) <> ''
on conflict do nothing;

create or replace function public.student_is_cas_member(p_cas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_cas_leader(p_cas_id)
    or exists (
      select 1 from public.cas_members
      where cas_id = p_cas_id
        and student_id = public.current_student_id()
    )
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
  if public.is_cas_leader(p_cas_id) then
    raise exception 'Leaders cannot leave. Remove yourself as a leader first.';
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
