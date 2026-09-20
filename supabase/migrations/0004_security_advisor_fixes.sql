-- Addresses Supabase Security Advisor warnings:
-- 1. Function Search Path Mutable: pin search_path on set_updated_at.
-- 2. Public/Signed-in Can Execute SECURITY DEFINER Function: these two
--    functions are trigger-only (they read NEW) and must never be called
--    directly via RPC, so revoke the default PUBLIC execute grant.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_card_owner_id() from public;
revoke execute on function public.set_quiz_attempt_lineage() from public;
