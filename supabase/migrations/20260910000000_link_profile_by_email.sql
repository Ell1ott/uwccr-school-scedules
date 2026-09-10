create or replace function public.link_profile_by_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or length(trim(new.email)) = 0 then
    return new;
  end if;

  if exists (
    select 1 from public.profiles where auth_user_id = new.id
  ) then
    return new;
  end if;

  update public.students
  set auth_user_id = new.id
  where lower(email) = lower(new.email);

  update public.teachers
  set auth_user_id = new.id
  where lower(email) = lower(new.email);

  update public.profiles
  set auth_user_id = new.id
  where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_link_profile on auth.users;
create trigger on_auth_user_created_link_profile
  after insert on auth.users
  for each row execute procedure public.link_profile_by_auth_email();
