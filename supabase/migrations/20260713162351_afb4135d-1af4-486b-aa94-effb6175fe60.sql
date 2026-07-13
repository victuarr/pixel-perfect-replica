
-- 1) Revoke EXECUTE from authenticated/anon/PUBLIC on trigger-only SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_accept_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_event_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_event_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) Notifications: remove permissive insert policy. All legitimate inserts happen via
--    SECURITY DEFINER triggers (which bypass RLS) or the server-role webhook.
DROP POLICY IF EXISTS "insert notifications as actor" ON public.notifications;

-- 3) Profiles: replace broad `USING (true)` with privacy-aware policy.
--    Helper: is the viewer an accepted follower of the profile owner (or the owner themselves).
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer_id = _profile_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _profile_id AND p.profile_privacy::text = 'open'
    )
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.followee_id = _profile_id
        AND f.follower_id = _viewer_id
        AND f.status::text = 'accepted'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles viewable by owner or accepted followers or if open"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(id, auth.uid()));
