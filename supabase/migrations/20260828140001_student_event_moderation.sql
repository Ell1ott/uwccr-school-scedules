alter table public.events
  add column if not exists moderation_token text;

create index if not exists events_moderation_token_idx
  on public.events (moderation_token)
  where moderation_token is not null;

create or replace function public.student_can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.event_audience a on a.event_id = e.id
    where e.id = p_event_id
      and e.status = 'published'
      and a.student_id = public.current_student_id()
  )
$$;

create or replace function public.seed_event_responses(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  student text;
  rsvp public.rsvp_status;
begin
  select * into ev from public.events where id = p_event_id;
  if not found then
    return;
  end if;
  if ev.mode not in ('mandatory', 'invite') then
    return;
  end if;

  if ev.mode = 'mandatory' then
    rsvp := 'going';
  else
    rsvp := 'pending';
  end if;

  for student in
    select student_id from public.event_audience where event_id = p_event_id
  loop
    insert into public.event_responses (
      event_id, student_id, status, source, responded_at
    )
    values (
      p_event_id,
      student,
      rsvp,
      'assigned',
      case when rsvp = 'going' then now() else null end
    )
    on conflict (event_id, student_id) do nothing;
  end loop;
end;
$$;

drop function if exists public.create_event_batch(
  text,
  text,
  text,
  timestamptz[],
  timestamptz[],
  boolean,
  public.event_mode,
  int,
  jsonb,
  text[],
  text,
  date
);

create function public.create_event_batch(
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
returns jsonb
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
  token text;
  next_status public.event_status;
begin
  profile_id := public.current_profile_id();
  if profile_id is null then
    raise exception 'No profile';
  end if;
  if not public.is_staff() and public.current_student_id() is null then
    raise exception 'Only staff and students can create events';
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

  if public.is_staff() then
    next_status := 'published';
    token := null;
  else
    next_status := 'pending';
    token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  end if;

  if p_freq in ('daily', 'weekly') and array_length(p_starts, 1) > 1 then
    insert into public.event_series (created_by, freq, until_date)
    values (
      profile_id,
      p_freq,
      coalesce(p_until_date, (p_starts[array_length(p_starts, 1)])::date)
    )
    returning id into series;
  end if;

  for i in 1 .. array_length(p_starts, 1) loop
    insert into public.events (
      series_id, created_by, title, description, location,
      starts_at, ends_at, all_day, mode, capacity, status, moderation_token
    )
    values (
      series, profile_id, trim(p_title), coalesce(p_description, ''),
      coalesce(p_location, ''), p_starts[i], p_ends[i], coalesce(p_all_day, false),
      p_mode, p_capacity, next_status, token
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
    end loop;

    if next_status = 'published' then
      perform public.seed_event_responses(event_id);
    end if;
  end loop;

  return jsonb_build_object(
    'event_ids', to_jsonb(event_ids),
    'moderation_token', token
  );
end;
$$;

create or replace function public.moderate_events_by_token(
  p_token text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sample public.events%rowtype;
  n int;
  ev_id uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'message', 'This link is missing a token.');
  end if;
  if p_decision not in ('allow', 'deny') then
    return jsonb_build_object('ok', false, 'message', 'Decision must be allow or deny.');
  end if;

  select * into sample
  from public.events
  where moderation_token = btrim(p_token)
  order by starts_at
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'This link is not valid.');
  end if;

  if sample.status = 'published' or sample.status = 'cancelled' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'message', 'This event was already allowed.'
    );
  end if;
  if sample.status = 'rejected' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'message', 'This event was already declined.'
    );
  end if;
  if sample.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'This event cannot be moderated.');
  end if;

  if p_decision = 'deny' then
    update public.events
    set status = 'rejected'
    where moderation_token = sample.moderation_token
      and status = 'pending';
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'message', 'Event declined.', 'count', n);
  end if;

  update public.events
  set status = 'published'
  where moderation_token = sample.moderation_token
    and status = 'pending';
  get diagnostics n = row_count;

  for ev_id in
    select id from public.events
    where moderation_token = sample.moderation_token
  loop
    perform public.seed_event_responses(ev_id);
  end loop;

  return jsonb_build_object('ok', true, 'message', 'Event allowed.', 'count', n);
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
      and status in ('published', 'pending');
    get diagnostics n = row_count;
  else
    update public.events
    set status = 'cancelled'
    where id = p_event_id
      and status in ('published', 'pending');
    get diagnostics n = row_count;
  end if;

  return n;
end;
$$;

drop policy if exists events_select on public.events;
create policy events_select
on public.events for select
to authenticated
using (
  created_by = public.current_profile_id()
  or (
    public.is_staff()
    and status in ('published', 'cancelled')
  )
  or public.student_can_see_event(id)
);

drop policy if exists events_update_own on public.events;
create policy events_update_own
on public.events for update
to authenticated
using (
  created_by = public.current_profile_id()
  and (
    public.is_staff()
    or status = 'pending'
  )
)
with check (
  created_by = public.current_profile_id()
  and (
    public.is_staff()
    or status = 'pending'
  )
);

drop policy if exists event_targets_select on public.event_targets;
create policy event_targets_select
on public.event_targets for select
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_id
      and (
        e.created_by = public.current_profile_id()
        or (public.is_staff() and e.status in ('published', 'cancelled'))
        or public.student_can_see_event(event_id)
      )
  )
);

drop policy if exists event_audience_select on public.event_audience;
create policy event_audience_select
on public.event_audience for select
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_id
      and e.created_by = public.current_profile_id()
  )
  or (
    student_id = public.current_student_id()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
  )
  or (
    public.is_staff()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status in ('published', 'cancelled')
    )
  )
);

drop policy if exists event_series_select on public.event_series;
create policy event_series_select
on public.event_series for select
to authenticated
using (public.is_staff() or created_by = public.current_profile_id());

grant execute on function public.create_event_batch(
  text, text, text, timestamptz[], timestamptz[], boolean,
  public.event_mode, int, jsonb, text[], text, date
) to authenticated;

revoke all on function public.seed_event_responses(uuid) from public;
revoke all on function public.seed_event_responses(uuid) from anon, authenticated;
revoke all on function public.moderate_events_by_token(text, text) from public;
revoke all on function public.moderate_events_by_token(text, text) from anon, authenticated;
grant execute on function public.moderate_events_by_token(text, text) to service_role;
