-- Local SQLite schema. Table and column names match the Supabase schema on purpose,
-- so local data can be exported to Supabase later (see scripts/export_to_supabase.py).
--
--   users        ~ auth.users   (id, email, password_hash as bcrypt, created_at)
--   profiles, friendships, game_invites, game_stats, email_otps  ~ same names in Supabase
--
-- Timestamps are ISO 8601 text in UTC. Ids are UUID text.

create table users (
  id             text primary key,
  email          text not null unique,
  password_hash  text,
  created_at     text not null
);

create table profiles (
  id          text primary key references users (id) on delete cascade,
  username    text not null unique check (length(username) between 3 and 20),
  avatar_url  text,
  created_at  text not null,
  updated_at  text not null
);

create table friendships (
  id            text primary key,
  requester_id  text not null references profiles (id) on delete cascade,
  addressee_id  text not null references profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    text not null,
  responded_at  text,
  check (requester_id <> addressee_id)
);

create unique index friendships_pair_idx on friendships (
  min(requester_id, addressee_id), max(requester_id, addressee_id)
);

create table game_invites (
  id          text primary key,
  from_id     text not null references profiles (id) on delete cascade,
  to_id       text not null references profiles (id) on delete cascade,
  game_id     text not null,
  room_id     text not null,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at  text not null,
  check (from_id <> to_id)
);

create table game_stats (
  user_id     text not null references profiles (id) on delete cascade,
  game_id     text not null,
  played      integer not null default 0 check (played >= 0),
  won         integer not null default 0 check (won >= 0 and won <= played),
  updated_at  text not null,
  primary key (user_id, game_id)
);

create table email_otps (
  email       text primary key,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  text not null,
  sent_at     text not null
);
