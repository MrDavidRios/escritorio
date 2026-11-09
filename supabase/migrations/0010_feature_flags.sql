-- Feature flags. A flag is on for a user when it's enabled globally, the
-- user is on its allowlist, or the user falls inside its rollout
-- percentage. Clients can't read the table (it holds user ids); they call
-- enabled_feature_flags(), which returns just the keys that are on for the
-- caller. Flip a flag with a migration or from the dashboard.

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  description text not null,
  -- On for everyone.
  enabled boolean not null default false,
  -- On for these users even when not enabled globally (e.g. beta testers).
  allowed_user_ids uuid[] not null default '{}',
  -- On for this share of users, picked by a stable hash of key + user id.
  rollout_percent integer not null default 0 check (rollout_percent between 0 and 100),
  created_at timestamptz not null default now()
);

-- RLS with no policies: no direct client access. Read through the function.
alter table public.feature_flags enable row level security;

create or replace function public.enabled_feature_flags()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select f.key
  from public.feature_flags f
  where f.enabled
    or auth.uid() = any (f.allowed_user_ids)
    -- First 28 bits of md5 as a non-negative int: stable across Postgres versions.
    or ('x' || substr(md5(f.key || ':' || auth.uid()::text), 1, 7))::bit(28)::integer % 100
      < f.rollout_percent
$$;

revoke execute on function public.enabled_feature_flags() from public, anon;
grant execute on function public.enabled_feature_flags() to authenticated;

insert into public.feature_flags (key, description)
values ('phrases', 'Phrase studying: daily spaced-repetition phrase practice');
