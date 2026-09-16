-- Adds an optional custom image to study sets. Stored in the existing
-- private flashcard-images bucket, under {owner_id}/sets/{study_set_id}.ext
-- -- nested so it can never collide with a card's {owner_id}/{card_id}.ext
-- path in the same bucket. No new bucket/policy needed: the existing
-- flashcard-images RLS policies only key off the first path segment being
-- the owner's auth.uid().
alter table public.study_sets add column image_path text;
