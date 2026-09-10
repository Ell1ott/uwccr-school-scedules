-- Undo a CAS session cancel by flipping status back to published.
-- Split originals are left cancelled while their replacement sessions
-- are still live, so restoring cannot double-book the same slot.

create or replace function public.restore_cas_session(
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
    raise exception 'Only leaders can restore sessions';
  end if;
  if sess.status <> 'cancelled' then
    raise exception 'This session is not cancelled';
  end if;

  if p_rest_of_series and sess.series_id is not null then
    update public.cas_sessions s
    set status = 'published'
    where s.series_id = sess.series_id
      and s.starts_at >= sess.starts_at
      and s.status = 'cancelled'
      and (
        s.split_group_id is not null
        or not exists (
          select 1
          from public.cas_sessions other
          where other.cas_id = s.cas_id
            and other.split_group_id is not null
            and other.status = 'published'
            and other.starts_at < s.ends_at
            and other.ends_at > s.starts_at
            and other.id <> s.id
        )
      );
    get diagnostics n = row_count;
  else
    if sess.split_group_id is null
      and exists (
        select 1
        from public.cas_sessions other
        where other.cas_id = sess.cas_id
          and other.split_group_id is not null
          and other.status = 'published'
          and other.starts_at < sess.ends_at
          and other.ends_at > sess.starts_at
          and other.id <> sess.id
      )
    then
      raise exception 'This session was replaced by a split';
    end if;

    update public.cas_sessions
    set status = 'published'
    where id = p_session_id
      and status = 'cancelled';
    get diagnostics n = row_count;
  end if;
  return n;
end;
$$;

revoke all on function public.restore_cas_session(uuid, boolean) from public;
grant execute on function public.restore_cas_session(uuid, boolean) to authenticated;
