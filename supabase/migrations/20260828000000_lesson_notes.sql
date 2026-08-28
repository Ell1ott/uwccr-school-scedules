create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.teachers (id) on delete cascade,
  on_date date not null,
  block text not null check (block in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
  body text not null check (char_length(trim(body)) > 0),
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, on_date, block)
);

alter table public.lesson_notes enable row level security;

drop policy if exists lesson_notes_select_public on public.lesson_notes;
create policy lesson_notes_select_public
on public.lesson_notes for select
to anon, authenticated
using (true);

drop policy if exists lesson_notes_insert_own on public.lesson_notes;
create policy lesson_notes_insert_own
on public.lesson_notes for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

drop policy if exists lesson_notes_update_own on public.lesson_notes;
create policy lesson_notes_update_own
on public.lesson_notes for update
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

drop policy if exists lesson_notes_delete_own on public.lesson_notes;
create policy lesson_notes_delete_own
on public.lesson_notes for delete
to authenticated
using (teacher_id = public.current_teacher_id());

grant select on public.lesson_notes to anon, authenticated;
grant insert, update, delete on public.lesson_notes to authenticated;

alter table public.lesson_notes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lesson_notes'
  ) then
    alter publication supabase_realtime add table public.lesson_notes;
  end if;
end
$$;
