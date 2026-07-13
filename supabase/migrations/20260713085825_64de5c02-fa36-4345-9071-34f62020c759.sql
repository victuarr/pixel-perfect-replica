
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_event_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
