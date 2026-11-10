-- Board Playable: initial schema.
-- Profiles, friends, game invites and per-game stats.
-- Run in the Supabase SQL editor, or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Profiles: one row per user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are visible to signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile from the username passed at sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form check a username before creating the account.
create function public.username_available(name text) returns boolean
language sql security definer set search_path = '' stable as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Friendships: a request from one user to another, accepted or declined.
-- ---------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted', 'declined');

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);

-- One friendship per pair, whichever side sent it.
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

create policy "Users see their own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create policy "Users send requests as themselves"
  on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy "Recipients answer requests"
  on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());

create policy "Either side can remove a friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- Game invites: ask a friend to join a room.
-- ---------------------------------------------------------------------------
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');

create table public.game_invites (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null,
  room_id     text not null,
  status      public.invite_status not null default 'pending',
  created_at  timestamptz not null default now(),
  check (from_id <> to_id)
);

create index game_invites_to_idx on public.game_invites (to_id, status);

alter table public.game_invites enable row level security;

create policy "Users see invites they sent or received"
  on public.game_invites for select to authenticated
  using (auth.uid() in (from_id, to_id));

create policy "Users send invites as themselves"
  on public.game_invites for insert to authenticated
  with check (from_id = auth.uid() and status = 'pending');

create policy "Recipients answer invites"
  on public.game_invites for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Game stats: per user, per game. Written by the API (service role) only.
-- ---------------------------------------------------------------------------
create table public.game_stats (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null,
  played      integer not null default 0 check (played >= 0),
  won         integer not null default 0 check (won >= 0 and won <= played),
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.game_stats enable row level security;

create policy "Stats are visible to signed-in users"
  on public.game_stats for select to authenticated using (true);

create trigger game_stats_touch before update on public.game_stats
  for each row execute function public.touch_updated_at();
