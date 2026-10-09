-- Lets an English equivalent satisfy a card's content requirement on its
-- own: a card now needs an image, a definition, or an English equivalent
-- (any one of them), instead of only an image or a definition.

alter table public.cards
  drop constraint cards_image_or_definition_required;

alter table public.cards
  add constraint cards_content_required
  check (image_path is not null or definition is not null or english_equivalent is not null);
