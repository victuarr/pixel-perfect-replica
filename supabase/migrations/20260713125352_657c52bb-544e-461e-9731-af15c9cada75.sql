
CREATE OR REPLACE FUNCTION public.event_going_count(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_root uuid;
  v_cnt  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT COALESCE(origin_id, id) INTO v_root FROM public.events WHERE id = _event_id;
  IF v_root IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT public.can_view_event(v_root, v_uid) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT count(DISTINCT uid) INTO v_cnt FROM (
    SELECT owner_id AS uid FROM public.events WHERE origin_id = v_root
    UNION
    SELECT invitee_id AS uid FROM public.event_invites WHERE event_id = v_root AND status = 'going'
  ) s;
  RETURN COALESCE(v_cnt, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.event_going_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_going_count(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_event(
  _origin_event_id uuid,
  _arrival         timestamptz DEFAULT NULL,
  _note            text        DEFAULT NULL,
  _visibility      public.event_visibility DEFAULT NULL,
  _list_ids        uuid[]      DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_root       uuid;
  v_owner      uuid;
  o_title      text;
  o_icon       text;
  o_place      text;
  o_starts     timestamptz;
  o_ends       timestamptz;
  o_color      text;
  v_visibility public.event_visibility;
  v_default_list uuid;
  v_new_id     uuid;
  v_existing   uuid;
  lid          uuid;
  v_lists      uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(e.origin_id, e.id) INTO v_root
    FROM public.events e WHERE e.id = _origin_event_id;
  IF v_root IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  SELECT owner_id, title, icon, place, starts_at, ends_at, list_color
    INTO v_owner, o_title, o_icon, o_place, o_starts, o_ends, o_color
    FROM public.events WHERE id = v_root;

  IF NOT public.can_view_event(v_root, v_uid) THEN
    RAISE EXCEPTION 'not allowed to view this event';
  END IF;

  IF v_owner = v_uid THEN
    RAISE EXCEPTION 'cannot join your own event';
  END IF;

  SELECT id INTO v_existing
    FROM public.events
   WHERE owner_id = v_uid AND origin_id = v_root
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF _visibility IS NULL THEN
    SELECT default_visibility_list_id INTO v_default_list
      FROM public.profiles WHERE id = v_uid;
    IF v_default_list IS NOT NULL THEN
      v_visibility := 'lists';
      v_lists := ARRAY[v_default_list];
    ELSE
      v_visibility := 'private';
    END IF;
  ELSE
    v_visibility := _visibility;
    v_lists := _list_ids;
  END IF;

  INSERT INTO public.events (
    owner_id, title, icon, place, starts_at, ends_at,
    description, visibility_type, origin_id, list_color
  ) VALUES (
    v_uid, o_title, o_icon, o_place,
    COALESCE(_arrival, o_starts), o_ends,
    _note, v_visibility, v_root, o_color
  )
  RETURNING id INTO v_new_id;

  IF v_visibility = 'lists' AND v_lists IS NOT NULL THEN
    FOREACH lid IN ARRAY v_lists LOOP
      IF EXISTS (SELECT 1 FROM public.lists WHERE id = lid AND owner_id = v_uid) THEN
        INSERT INTO public.event_lists (event_id, list_id)
        VALUES (v_new_id, lid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_event(uuid, timestamptz, text, public.event_visibility, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_event(uuid, timestamptz, text, public.event_visibility, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leave_event(_origin_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_root uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT COALESCE(origin_id, id) INTO v_root FROM public.events WHERE id = _origin_event_id;
  IF v_root IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.events
   WHERE owner_id = v_uid AND origin_id = v_root;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_event(uuid) TO authenticated, service_role;
