-- Flashcards app schema: study_sets, cards, RLS policies, and the
-- flashcard-images storage bucket + its policies.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once
-- against a fresh project.

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- study_sets
-- ---------------------------------------------------------------------
create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_sets_owner_id_idx on public.study_sets (owner_id);

create trigger study_sets_set_updated_at
  before update on public.study_sets
  for each row
  execute function public.set_updated_at();

alter table public.study_sets enable row level security;

create policy "study_sets_select_own"
  on public.study_sets for select
  using (owner_id = auth.uid());

create policy "study_sets_insert_own"
  on public.study_sets for insert
  with check (owner_id = auth.uid());

create policy "study_sets_update_own"
  on public.study_sets for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "study_sets_delete_own"
  on public.study_sets for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  -- Denormalized for simple RLS checks (avoids a join in every policy).
  -- Always set server-side by the trigger below -- never trust a
  -- client-supplied owner_id, or a user could insert a card into
  -- someone else's set by spoofing this column.
  owner_id uuid not null references auth.users (id) on delete cascade,
  image_path text not null,
  hint text,
  answer text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_study_set_id_idx on public.cards (study_set_id);
create index cards_owner_id_idx on public.cards (owner_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row
  execute function public.set_updated_at();

-- Force owner_id to match the parent study set's owner, regardless of
-- what the client sends. This also means an insert into a study_set_id
-- you don't own will fail (the parent row won't be visible/found under
-- RLS from your session in the first place via the FK + study_sets RLS),
-- but this trigger is the actual, explicit guarantee -- don't rely on
-- the FK/RLS interaction alone.
create or replace function public.set_card_owner_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id into new.owner_id
  from public.study_sets
  where id = new.study_set_id;

  if new.owner_id is null then
    raise exception 'study_set_id % does not exist', new.study_set_id;
  end if;

  return new;
end;
$$;

create trigger cards_set_owner_id
  before insert on public.cards
  for each row
  execute function public.set_card_owner_id();

alter table public.cards enable row level security;

create policy "cards_select_own"
  on public.cards for select
  using (owner_id = auth.uid());

create policy "cards_insert_own"
  on public.cards for insert
  with check (owner_id = auth.uid());

create policy "cards_update_own"
  on public.cards for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "cards_delete_own"
  on public.cards for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage: flashcard-images (private bucket)
-- Path convention: {owner_id}/{card_id}.{ext}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('flashcard-images', 'flashcard-images', false);

create policy "flashcard_images_select_own"
  on storage.objects for select
  using (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "flashcard_images_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "flashcard_images_update_own"
  on storage.objects for update
  using (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "flashcard_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
