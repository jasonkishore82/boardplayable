-- Email-first sign-up: the account is created from a verified email, and the
-- username and password are chosen afterwards. So the profile can no longer be
-- created by the sign-up trigger (there is no username yet).

-- Only create a profile at sign-up when a username was supplied (older flow).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(new.raw_user_meta_data ->> 'username', '') is not null then
    insert into public.profiles (id, username)
    values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  end if;
  return new;
end;
$$;

-- Called by the app after the email code is verified, to claim a username.
-- Raises unique_violation (23505) when the name is already taken.
create function public.complete_signup(name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  clean text := lower(trim(name));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if clean !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles (id, username) values (auth.uid(), clean)
  on conflict (id) do update set username = excluded.username;
end;
$$;

revoke all on function public.complete_signup(text) from public, anon;
grant execute on function public.complete_signup(text) to authenticated;
