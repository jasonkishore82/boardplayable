-- Direct messages between friends.
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 1000),
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index messages_sender_idx on public.messages (sender_id, recipient_id, created_at);
create index messages_recipient_idx on public.messages (recipient_id, sender_id, created_at);

alter table public.messages enable row level security;

create policy "People see their own messages"
  on public.messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));

-- You can only write as yourself, and only to an accepted friend.
create policy "Friends can message each other"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = sender_id and f.addressee_id = recipient_id)
          or (f.requester_id = recipient_id and f.addressee_id = sender_id))
    )
  );
