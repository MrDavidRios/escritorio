-- Renames answer -> spanish_term for clarity, adds english_equivalent and
-- definition as optional text fields, and makes image_path optional so a
-- card can be backed by an image, a definition, or both.

alter table public.cards rename column answer to spanish_term;

alter table public.cards add column english_equivalent text;
alter table public.cards add column definition text;

alter table public.cards alter column image_path drop not null;

alter table public.cards
  add constraint cards_image_or_definition_required
  check (image_path is not null or definition is not null);
