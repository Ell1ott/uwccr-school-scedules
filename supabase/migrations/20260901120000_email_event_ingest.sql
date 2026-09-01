create table if not exists public.email_ingest_log (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  message_id text,
  from_address text not null default '',
  subject text not null default '',
  decision text not null check (
    decision in ('processing', 'skipped', 'proposed', 'error')
  ),
  reason text not null default '',
  event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_ingest_log_message_id_idx
  on public.email_ingest_log (message_id)
  where message_id is not null;

alter table public.email_ingest_log enable row level security;

revoke all on public.email_ingest_log from public, anon, authenticated;
grant select, insert, update on public.email_ingest_log to service_role;

create or replace function public.create_pending_event_batch(
  p_created_by uuid,
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
  series uuid;
  event_ids uuid[] := '{}';
  event_id uuid;
  i int;
  target jsonb;
  student text;
  token text;
begin
  if p_created_by is null or not exists (
    select 1 from public.profiles where id = p_created_by
  ) then
    raise exception 'No profile';
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

  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  if p_freq in ('daily', 'weekly') and array_length(p_starts, 1) > 1 then
    insert into public.event_series (created_by, freq, until_date)
    values (
      p_created_by,
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
      series, p_created_by, trim(p_title), coalesce(p_description, ''),
      coalesce(p_location, ''), p_starts[i], p_ends[i], coalesce(p_all_day, false),
      p_mode, p_capacity, 'pending', token
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
  end loop;

  return jsonb_build_object(
    'event_ids', to_jsonb(event_ids),
    'moderation_token', token
  );
end;
$$;

revoke all on function public.create_pending_event_batch(
  uuid, text, text, text, timestamptz[], timestamptz[], boolean,
  public.event_mode, int, jsonb, text[], text, date
) from public, anon, authenticated;
grant execute on function public.create_pending_event_batch(
  uuid, text, text, text, timestamptz[], timestamptz[], boolean,
  public.event_mode, int, jsonb, text[], text, date
) to service_role;

notify pgrst, 'reload schema';
