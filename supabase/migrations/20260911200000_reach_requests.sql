create type public.reach_leave_type as enum (
  'day',
  'fri_sat_evening',
  'sun_thu_evening',
  'mayo_2026',
  'medical',
  'overnight',
  'special'
);

create type public.reach_request_status as enum (
  'pending',
  'approved',
  'denied',
  'cancelled'
);

create type public.reach_companion_status as enum (
  'pending',
  'accepted',
  'declined'
);

create type public.reach_transport_mode as enum (
  'walking',
  'car',
  'school_transport',
  'taxi',
  'train',
  'uber'
);

create table if not exists public.reach_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  leave_type public.reach_leave_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  destination text not null check (char_length(trim(destination)) > 0),
  notes text not null default '',
  host_name text not null default '',
  host_phone text not null default '',
  host_address text not null default '',
  status public.reach_request_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reach_requests_time_order check (ends_at > starts_at)
);

create table if not exists public.reach_transports (
  request_id uuid not null references public.reach_requests (id) on delete cascade,
  sort_order int not null check (sort_order >= 0),
  mode public.reach_transport_mode not null,
  primary key (request_id, sort_order)
);

create table if not exists public.reach_companions (
  request_id uuid not null references public.reach_requests (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  invited_by text not null references public.students (id) on delete cascade,
  status public.reach_companion_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, student_id)
);

create table if not exists public.reach_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.reach_requests (id) on delete cascade,
  path text not null unique,
  file_name text not null,
  mime text not null default '',
  byte_size bigint not null default 0 check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists reach_requests_student_idx
  on public.reach_requests (student_id, starts_at desc);
create index if not exists reach_requests_created_by_idx
  on public.reach_requests (created_by, created_at desc);
create index if not exists reach_requests_status_idx
  on public.reach_requests (status);
create index if not exists reach_companions_student_idx
  on public.reach_companions (student_id, status);
create index if not exists reach_documents_request_idx
  on public.reach_documents (request_id);

create or replace function public.touch_reach_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reach_requests_touch_updated_at on public.reach_requests;
create trigger reach_requests_touch_updated_at
before update on public.reach_requests
for each row execute procedure public.touch_reach_updated_at();

create or replace function public.can_see_reach_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reach_requests r
    where r.id = p_request_id
      and (
        public.is_staff()
        or r.created_by = public.current_profile_id()
        or r.student_id = public.current_student_id()
        or exists (
          select 1
          from public.reach_companions c
          where c.request_id = r.id
            and c.student_id = public.current_student_id()
        )
      )
  )
$$;

create or replace function public.is_reach_request_creator(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reach_requests r
    where r.id = p_request_id
      and r.created_by = public.current_profile_id()
  )
$$;

create or replace function public.reach_storage_request_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(p_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.create_reach_request(
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
  request_id uuid;
  starts_at timestamptz;
  destination text;
  companion_id text;
  transport public.reach_transport_mode;
  i int;
begin
  profile_id := public.current_profile_id();
  sid := public.current_student_id();
  if profile_id is null or sid is null then
    raise exception 'Sign in as a student to request leave';
  end if;

  destination := btrim(coalesce(p_destination, ''));
  if destination = '' then
    raise exception 'Say where you are going';
  end if;

  if p_transports is null or coalesce(array_length(p_transports, 1), 0) = 0 then
    raise exception 'Pick how you are getting there';
  end if;

  starts_at := coalesce(p_starts_at, now());
  if starts_at < now() - interval '90 seconds' then
    raise exception 'Start time has to be now or later';
  end if;
  if p_ends_at is null or p_ends_at <= starts_at then
    raise exception 'End time has to be after the start';
  end if;
  if p_ends_at < now() - interval '90 seconds' then
    raise exception 'End time has to be now or later';
  end if;

  insert into public.reach_requests (
    created_by,
    student_id,
    leave_type,
    starts_at,
    ends_at,
    destination,
    notes,
    host_name,
    host_phone,
    host_address,
    status
  )
  values (
    profile_id,
    sid,
    p_leave_type,
    starts_at,
    p_ends_at,
    destination,
    coalesce(p_notes, ''),
    coalesce(p_host_name, ''),
    coalesce(p_host_phone, ''),
    coalesce(p_host_address, ''),
    case
      when p_leave_type = 'day' then 'approved'::public.reach_request_status
      else 'pending'::public.reach_request_status
    end
  )
  returning id into request_id;

  for i in 1 .. array_length(p_transports, 1) loop
    transport := p_transports[i];
    insert into public.reach_transports (request_id, sort_order, mode)
    values (request_id, i - 1, transport);
  end loop;

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
      values (request_id, companion_id, sid, 'pending')
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object('id', request_id);
end;
$$;

create or replace function public.respond_reach_invite(
  p_request_id uuid,
  p_accept boolean
)
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
    raise exception 'Sign in as a student to answer an invite';
  end if;

  update public.reach_companions
  set
    status = case
      when p_accept then 'accepted'::public.reach_companion_status
      else 'declined'::public.reach_companion_status
    end,
    responded_at = now()
  where request_id = p_request_id
    and student_id = sid
    and status = 'pending';

  if not found then
    raise exception 'That invite is no longer waiting';
  end if;
end;
$$;

create or replace function public.attach_reach_documents(
  p_request_id uuid,
  p_documents jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc jsonb;
  doc_path text;
begin
  if not public.is_reach_request_creator(p_request_id) then
    raise exception 'Only the student who created this leave can add documents';
  end if;
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Documents have to be a list';
  end if;

  for doc in select value from jsonb_array_elements(p_documents) loop
    doc_path := btrim(coalesce(doc ->> 'path', ''));
    if doc_path = '' or split_part(doc_path, '/', 1) <> p_request_id::text then
      raise exception 'Document path does not belong to this request';
    end if;
    insert into public.reach_documents (
      request_id,
      path,
      file_name,
      mime,
      byte_size
    )
    values (
      p_request_id,
      doc_path,
      coalesce(nullif(btrim(doc ->> 'file_name'), ''), 'document'),
      coalesce(doc ->> 'mime', ''),
      greatest(coalesce((doc ->> 'size')::bigint, 0), 0)
    )
    on conflict (path) do update
    set
      file_name = excluded.file_name,
      mime = excluded.mime,
      byte_size = excluded.byte_size;
  end loop;
end;
$$;

alter table public.reach_requests enable row level security;
alter table public.reach_transports enable row level security;
alter table public.reach_companions enable row level security;
alter table public.reach_documents enable row level security;

create policy reach_requests_select
on public.reach_requests for select
to authenticated
using (public.can_see_reach_request(id));

create policy reach_transports_select
on public.reach_transports for select
to authenticated
using (public.can_see_reach_request(request_id));

create policy reach_companions_select
on public.reach_companions for select
to authenticated
using (public.can_see_reach_request(request_id));

create policy reach_documents_select
on public.reach_documents for select
to authenticated
using (public.can_see_reach_request(request_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reach-documents',
  'reach-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reach_documents_storage_select on storage.objects;
create policy reach_documents_storage_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'reach-documents'
  and public.can_see_reach_request(public.reach_storage_request_id(name))
);

drop policy if exists reach_documents_storage_insert on storage.objects;
create policy reach_documents_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'reach-documents'
  and public.is_reach_request_creator(public.reach_storage_request_id(name))
);

drop policy if exists reach_documents_storage_delete on storage.objects;
create policy reach_documents_storage_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'reach-documents'
  and public.is_reach_request_creator(public.reach_storage_request_id(name))
);

grant usage on type public.reach_leave_type to authenticated;
grant usage on type public.reach_request_status to authenticated;
grant usage on type public.reach_companion_status to authenticated;
grant usage on type public.reach_transport_mode to authenticated;

grant select on public.reach_requests to authenticated;
grant select on public.reach_transports to authenticated;
grant select on public.reach_companions to authenticated;
grant select on public.reach_documents to authenticated;

revoke all on function public.can_see_reach_request(uuid) from public;
revoke all on function public.is_reach_request_creator(uuid) from public;
revoke all on function public.reach_storage_request_id(text) from public;

grant execute on function public.can_see_reach_request(uuid) to authenticated;
grant execute on function public.is_reach_request_creator(uuid) to authenticated;
grant execute on function public.reach_storage_request_id(text) to authenticated;
grant execute on function public.create_reach_request(
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
grant execute on function public.respond_reach_invite(uuid, boolean) to authenticated;
grant execute on function public.attach_reach_documents(uuid, jsonb) to authenticated;

alter table public.reach_requests replica identity full;
alter table public.reach_transports replica identity full;
alter table public.reach_companions replica identity full;
alter table public.reach_documents replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reach_requests'
  ) then
    alter publication supabase_realtime add table public.reach_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reach_companions'
  ) then
    alter publication supabase_realtime add table public.reach_companions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reach_documents'
  ) then
    alter publication supabase_realtime add table public.reach_documents;
  end if;
end
$$;
