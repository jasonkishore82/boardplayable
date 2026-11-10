-- One-time sign-up codes issued by the API. Only a keyed hash of each code is stored.
-- Row-level security is on with no policies, so only the service role (the API) can touch it.
create table public.email_otps (
  email       text primary key,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  sent_at     timestamptz not null default now()
);

alter table public.email_otps enable row level security;
revoke all on table public.email_otps from anon, authenticated;
