create or replace function public.pending_events_for_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'description', e.description,
        'location', e.location,
        'starts_at', e.starts_at,
        'ends_at', e.ends_at,
        'all_day', e.all_day,
        'mode', e.mode,
        'capacity', e.capacity,
        'created_by', e.created_by
      )
      order by e.starts_at
    ),
    '[]'::jsonb
  )
  from public.events e
  where e.moderation_token = btrim(p_token)
    and e.status = 'pending'
    and e.created_by = public.current_profile_id();
$$;

revoke all on function public.pending_events_for_token(text) from public;
grant execute on function public.pending_events_for_token(text) to authenticated;

notify pgrst, 'reload schema';
