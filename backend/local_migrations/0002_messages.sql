-- Direct messages between friends. Same names as the Supabase `messages` table.
create table messages (
  id            text primary key,
  sender_id     text not null references profiles (id) on delete cascade,
  recipient_id  text not null references profiles (id) on delete cascade,
  body          text not null check (length(body) between 1 and 1000),
  created_at    text not null,
  check (sender_id <> recipient_id)
);

create index messages_sender_idx on messages (sender_id, recipient_id, created_at);
create index messages_recipient_idx on messages (recipient_id, sender_id, created_at);
