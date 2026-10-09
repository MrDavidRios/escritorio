-- Lets an English equivalent satisfy a card's content requirement on its
-- own: a card now needs an image, a definition, or an English equivalent
-- (any one of them), instead of only an image or a definition.
--
-- Idempotent: this was first applied by hand in the SQL editor, so the
-- old constraint may already be gone and the new one already present.

alter table public.cards
  drop constraint if exists cards_image_or_definition_required;

alter table public.cards
  drop constraint if exists cards_content_required;

alter table public.cards
  add constraint cards_content_required
  check (image_path is not null or definition is not null or english_equivalent is not null);
