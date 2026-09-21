-- Adds selectable study modes: 'conversion' (EN<->ES word drill) and
-- 'meaning' (definition/image -> ES, today's existing behavior).
-- study_sets carries the persisted picker state; study_sessions logs
-- one row per study run for future favorite-mode/success-rate
-- analytics; quiz_attempts gains enough context to join back to it.

create type public.study_mode as enum ('conversion', 'meaning');
create type public.conversion_direction as enum ('en_es', 'es_en', 'random');
create type public.meaning_visibility as enum ('image', 'definition', 'both');

-- Defaults preserve today's fixed behavior (image + definition ->
-- typed Spanish answer) for every existing study set.
alter table public.study_sets
  add column study_mode study_mode not null default 'meaning',
  add column conversion_direction conversion_direction not null default 'en_es',
  add column meaning_visibility meaning_visibility not null default 'both';

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  mode study_mode not null,
  direction conversion_direction,
  visibility meaning_visibility,
  deck_size integer not null,
  cards_answered integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint study_sessions_direction_matches_mode
    check ((mode = 'conversion') = (direction is not null)),
  constraint study_sessions_visibility_matches_mode
    check ((mode = 'meaning') = (visibility is not null))
);

create index study_sessions_study_set_id_idx on public.study_sessions (study_set_id);
create index study_sessions_owner_id_idx on public.study_sessions (owner_id);

-- Mirrors cards_set_owner_id / set_quiz_attempt_lineage: force owner_id
-- to match the referenced study set, regardless of what the client
-- sends, so a client can't misattribute a session to someone else's set.
create or replace function public.set_study_session_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id
  into new.owner_id
  from public.study_sets
  where id = new.study_set_id;

  if new.owner_id is null then
    raise exception 'study_set_id % does not exist', new.study_set_id;
  end if;

  return new;
end;
$$;

create trigger study_sessions_set_lineage
  before insert on public.study_sessions
  for each row
  execute function public.set_study_session_lineage();

-- Unlike quiz_attempts (strictly append-only), a session row is opened
-- at start and closed at completion. This trigger pins every column
-- except completed_at/cards_answered to its original value, so an
-- update can never rewrite a session into a different mode/config.
create or replace function public.guard_study_session_update()
returns trigger
language plpgsql
as $$
begin
  new.study_set_id := old.study_set_id;
  new.owner_id := old.owner_id;
  new.mode := old.mode;
  new.direction := old.direction;
  new.visibility := old.visibility;
  new.deck_size := old.deck_size;
  new.started_at := old.started_at;
  return new;
end;
$$;

create trigger study_sessions_guard_update
  before update on public.study_sessions
  for each row
  execute function public.guard_study_session_update();

alter table public.study_sessions enable row level security;

create policy "study_sessions_select_own"
  on public.study_sessions for select
  using (owner_id = auth.uid());

create policy "study_sessions_insert_own"
  on public.study_sessions for insert
  with check (owner_id = auth.uid());

create policy "study_sessions_update_own"
  on public.study_sessions for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table public.quiz_attempts
  add column session_id uuid references public.study_sessions (id) on delete set null,
  add column resolved_direction conversion_direction;

create index quiz_attempts_session_id_idx on public.quiz_attempts (session_id);
