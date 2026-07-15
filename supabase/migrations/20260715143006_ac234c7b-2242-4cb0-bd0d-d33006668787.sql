
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- handle_new_user should only be called by the auth trigger, not by API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role and get_user_distribuidora_id are used in RLS; keep executable by authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_distribuidora_id(UUID) FROM PUBLIC, anon;
