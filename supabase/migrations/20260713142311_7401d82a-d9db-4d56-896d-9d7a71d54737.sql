CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner(_list_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lists WHERE id = _list_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_list_member(_list_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.list_members WHERE list_id = _list_id AND member_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.event_visible_via_list(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_lists el
    JOIN public.list_members lm ON lm.list_id = el.list_id
    WHERE el.event_id = _event_id AND lm.member_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_invitee(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invitee_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_event(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND (
        e.owner_id = _user_id
        OR e.visibility_type = 'public'
        OR public.event_visible_via_list(e.id, _user_id)
        OR public.is_event_invitee(e.id, _user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_owner(uuid, uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_list_owner(uuid, uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_list_member(uuid, uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_visible_via_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_event_invitee(uuid, uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_event(uuid, uuid)        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_event_owner(uuid, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_list_owner(uuid, uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_list_member(uuid, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.event_visible_via_list(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_invitee(uuid, uuid)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_event(uuid, uuid)        TO authenticated, service_role;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'event_lists' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_lists', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "events select owner" ON public.events
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "events select public" ON public.events
  FOR SELECT TO authenticated
  USING (visibility_type = 'public');

CREATE POLICY "events select via list" ON public.events
  FOR SELECT TO authenticated
  USING (visibility_type = 'lists' AND public.event_visible_via_list(id, auth.uid()));

CREATE POLICY "events select invitee" ON public.events
  FOR SELECT TO authenticated
  USING (public.is_event_invitee(id, auth.uid()));

CREATE POLICY "events insert owner" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "events update owner" ON public.events
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "events delete owner" ON public.events
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "event_lists select" ON public.event_lists
  FOR SELECT TO authenticated
  USING (
    public.is_event_owner(event_id, auth.uid())
    OR public.is_list_member(list_id, auth.uid())
  );

CREATE POLICY "event_lists insert" ON public.event_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_event_owner(event_id, auth.uid())
    AND public.is_list_owner(list_id, auth.uid())
  );

CREATE POLICY "event_lists delete" ON public.event_lists
  FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()));