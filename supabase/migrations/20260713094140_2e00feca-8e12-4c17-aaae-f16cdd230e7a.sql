CREATE OR REPLACE FUNCTION public.can_view_event(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = _event_id
      AND (
        e.owner_id = _user_id
        OR e.visibility_type = 'public'
        OR EXISTS (
          SELECT 1
          FROM public.event_lists el
          JOIN public.list_members lm ON lm.list_id = el.list_id
          WHERE el.event_id = e.id AND lm.member_id = _user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.event_invites ei
          WHERE ei.event_id = e.id AND ei.invitee_id = _user_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.notify_event_activity FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_event_activity TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_view_event FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_event TO authenticated, service_role;