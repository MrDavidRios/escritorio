-- Phrase spaced repetition: one per-user phrase collection (independent of
-- study sets) reviewed on an SM-2-style schedule. See
-- docs/superpowers/specs/2026-10-13-phrase-spaced-repetition-design.md.
--
-- Scheduling math runs client-side; record_phrase_review persists a
-- review's log row and the phrase's new schedule in one transaction.
-- Practice-ahead reviews are logged but never touch the schedule -- that
-- rule is enforced here, not trusted to the client.

create type public.phrase_rating as enum ('again', 'hard', 'good');
create type public.phrase_grade_source as enum ('exact', 'jev', 'fallback');

-- ---------------------------------------------------------------------
-- phrases: content + schedule (one direction, so one schedule per phrase)
-- ---------------------------------------------------------------------
create table public.phrases (
  id uuid primary key default gen_random_uuid(),
  -- Always set server-side by the trigger below; never trust the client.
  owner_id uuid not null references auth.users (id) on delete cascade,
  spanish text not null check (btrim(spanish) <> ''),
  english text not null check (btrim(english) <> ''),
  example text,
  -- flashcard-images bucket, {owner_id}/phrases/{phrase_id}.{ext}
  image_path text,
  -- Set when added from the idiom list. Content is copied, not linked.
  idiom_id uuid references public.idioms (id) on delete set null,
  -- Schedule. due_on null = new, not yet introduced. Dates are the
  -- learner's local calendar dates, supplied by the client.
  due_on date,
  introduced_on date,
  interval_days integer not null default 0 check (interval_days >= 0),
  ease numeric(4, 2) not null default 2.00 check (ease >= 1.30),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idiom_id)
);

create index phrases_owner_id_due_on_idx on public.phrases (owner_id, due_on);

create trigger phrases_set_updated_at
  before update on public.phrases
  for each row
  execute function public.set_updated_at();

create or replace function public.set_phrase_owner_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.owner_id := auth.uid();
  if new.owner_id is null then
    raise exception 'must be signed in to add a phrase';
  end if;
  return new;
end;
$$;

revoke execute on function public.set_phrase_owner_id() from public;

create trigger phrases_set_owner_id
  before insert on public.phrases
  for each row
  execute function public.set_phrase_owner_id();

alter table public.phrases enable row level security;

create policy "phrases_select_own"
  on public.phrases for select
  using (owner_id = auth.uid());

create policy "phrases_insert_own"
  on public.phrases for insert
  with check (owner_id = auth.uid());

create policy "phrases_update_own"
  on public.phrases for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "phrases_delete_own"
  on public.phrases for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- phrase_reviews: append-only log of every resolved phrase (due or practice)
-- ---------------------------------------------------------------------
create table public.phrase_reviews (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references public.phrases (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  reviewed_on date not null,
  rating phrase_rating not null,
  attempt_count integer not null check (attempt_count between 1 and 3),
  typed_answer text not null check (char_length(typed_answer) <= 500),
  grade_source phrase_grade_source not null,
  jev_verdict text,
  -- Practice-ahead reviews: logged for history, never read by scheduling.
  -- Queries counting "reviews done today" must filter on this.
  is_practice boolean not null,
  created_at timestamptz not null default now()
);

create index phrase_reviews_phrase_id_idx on public.phrase_reviews (phrase_id);
create index phrase_reviews_owner_id_reviewed_on_idx
  on public.phrase_reviews (owner_id, reviewed_on);

-- Mirrors set_quiz_attempt_lineage: owner_id always comes from the phrase.
create or replace function public.set_phrase_review_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id into new.owner_id
  from public.phrases
  where id = new.phrase_id;

  if new.owner_id is null then
    raise exception 'phrase_id % does not exist', new.phrase_id using errcode = 'PR404';
  end if;

  return new;
end;
$$;

revoke execute on function public.set_phrase_review_lineage() from public;

create trigger phrase_reviews_set_lineage
  before insert on public.phrase_reviews
  for each row
  execute function public.set_phrase_review_lineage();

alter table public.phrase_reviews enable row level security;

-- Append-only: select/insert only.
create policy "phrase_reviews_select_own"
  on public.phrase_reviews for select
  using (owner_id = auth.uid());

create policy "phrase_reviews_insert_own"
  on public.phrase_reviews for insert
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_settings: one row per user; a missing row means defaults
-- ---------------------------------------------------------------------
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  new_phrases_per_day integer not null default 10 check (new_phrases_per_day between 0 and 100),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row
  execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings for select
  using (owner_id = auth.uid());

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (owner_id = auth.uid());

create policy "user_settings_update_own"
  on public.user_settings for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- record_phrase_review: log row + schedule update in one transaction
-- ---------------------------------------------------------------------
-- security invoker: RLS applies, so another user's phrase is "not found".
-- Errors the client handles:
--   PR404 -- phrase doesn't exist (or isn't yours); e.g. deleted mid-session.
--   PR409 -- scheduled review of a phrase that isn't due; the review was
--            already recorded (a retry or a second tab got there first).
create or replace function public.record_phrase_review(
  p_phrase_id uuid,
  p_reviewed_on date,
  p_rating public.phrase_rating,
  p_attempt_count integer,
  p_typed_answer text,
  p_grade_source public.phrase_grade_source,
  p_jev_verdict text,
  p_is_practice boolean,
  p_due_on date default null,
  p_interval_days integer default null,
  p_ease numeric default null,
  p_reps integer default null,
  p_lapses integer default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_due_on date;
begin
  select due_on into v_due_on
  from public.phrases
  where id = p_phrase_id
  for update;

  if not found then
    raise exception 'phrase % not found', p_phrase_id using errcode = 'PR404';
  end if;

  if not p_is_practice then
    if v_due_on is not null and v_due_on > p_reviewed_on then
      raise exception 'phrase % is not due until %', p_phrase_id, v_due_on
        using errcode = 'PR409';
    end if;
    if p_due_on is null or p_interval_days is null or p_ease is null
      or p_reps is null or p_lapses is null then
      raise exception 'a scheduled review needs the new schedule';
    end if;
  end if;

  insert into public.phrase_reviews (
    phrase_id, reviewed_on, rating, attempt_count, typed_answer,
    grade_source, jev_verdict, is_practice
  ) values (
    p_phrase_id, p_reviewed_on, p_rating, p_attempt_count, p_typed_answer,
    p_grade_source, p_jev_verdict, p_is_practice
  );

  if not p_is_practice then
    update public.phrases
    set due_on = p_due_on,
        interval_days = p_interval_days,
        ease = p_ease,
        reps = p_reps,
        lapses = p_lapses,
        introduced_on = coalesce(introduced_on, p_reviewed_on)
    where id = p_phrase_id;
  end if;
end;
$$;

revoke execute on function public.record_phrase_review(
  uuid, date, public.phrase_rating, integer, text, public.phrase_grade_source,
  text, boolean, date, integer, numeric, integer, integer
) from public, anon;

grant execute on function public.record_phrase_review(
  uuid, date, public.phrase_rating, integer, text, public.phrase_grade_source,
  text, boolean, date, integer, numeric, integer, integer
) to authenticated;
