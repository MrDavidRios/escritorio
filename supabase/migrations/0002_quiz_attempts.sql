-- Quiz attempt logging: one append-only row per card each time it's
-- resolved in a quiz session (answered correctly, or revealed after
-- MAX_ATTEMPTS misses). No update/delete policies -- rows are never
-- edited or removed by the app.

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  -- Denormalized for simple RLS + per-set queries without a join through
  -- cards. Always set server-side by the trigger below -- never trust a
  -- client-supplied study_set_id/owner_id.
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_correct boolean not null,
  attempt_count integer not null,
  answered_at timestamptz not null default now()
);

create index quiz_attempts_card_id_idx on public.quiz_attempts (card_id);
create index quiz_attempts_study_set_id_idx on public.quiz_attempts (study_set_id);
create index quiz_attempts_owner_id_idx on public.quiz_attempts (owner_id);

-- Mirrors cards_set_owner_id: force study_set_id/owner_id to match the
-- referenced card, regardless of what the client sends, so a client
-- can't misattribute an attempt to someone else's card or set.
create or replace function public.set_quiz_attempt_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select study_set_id, owner_id
  into new.study_set_id, new.owner_id
  from public.cards
  where id = new.card_id;

  if new.owner_id is null then
    raise exception 'card_id % does not exist', new.card_id;
  end if;

  return new;
end;
$$;

create trigger quiz_attempts_set_lineage
  before insert on public.quiz_attempts
  for each row
  execute function public.set_quiz_attempt_lineage();

alter table public.quiz_attempts enable row level security;

-- Append-only: select/insert only, no update/delete policies.
create policy "quiz_attempts_select_own"
  on public.quiz_attempts for select
  using (owner_id = auth.uid());

create policy "quiz_attempts_insert_own"
  on public.quiz_attempts for insert
  with check (owner_id = auth.uid());
