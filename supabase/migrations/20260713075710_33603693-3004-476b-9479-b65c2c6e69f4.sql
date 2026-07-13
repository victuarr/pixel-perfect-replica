-- ============ list_members ============
CREATE TABLE public.list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_members TO authenticated;
GRANT ALL ON public.list_members TO service_role;

ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- Members see rows about themselves; list owner sees all rows of their list.
CREATE POLICY "Member or list owner can view membership"
  ON public.list_members FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

CREATE POLICY "List owner can add members"
  ON public.list_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

CREATE POLICY "List owner can remove members"
  ON public.list_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

CREATE INDEX list_members_member_idx ON public.list_members (member_id);
CREATE INDEX list_members_list_idx ON public.list_members (list_id);

-- ============ event_lists ============
CREATE TABLE public.event_lists (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, list_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lists TO authenticated;
GRANT ALL ON public.event_lists TO service_role;

ALTER TABLE public.event_lists ENABLE ROW LEVEL SECURITY;

-- Event owner manages the pairing; list members can see the pairing (needed if we ever join)
CREATE POLICY "Event owner or list member can view event_lists"
  ON public.event_lists FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.list_members lm WHERE lm.list_id = event_lists.list_id AND lm.member_id = auth.uid())
  );

CREATE POLICY "Event owner can insert event_lists"
  ON public.event_lists FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

CREATE POLICY "Event owner can delete event_lists"
  ON public.event_lists FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  );

CREATE INDEX event_lists_list_idx ON public.event_lists (list_id);

-- ============ events: extend SELECT policies ============
-- Existing "Owner can view own events" stays. Add public + list-shared visibility.

CREATE POLICY "Public events are viewable by everyone signed in"
  ON public.events FOR SELECT TO authenticated
  USING (visibility_type = 'public');

CREATE POLICY "List-shared events are viewable by list members"
  ON public.events FOR SELECT TO authenticated
  USING (
    visibility_type = 'lists'
    AND EXISTS (
      SELECT 1
      FROM public.event_lists el
      JOIN public.list_members lm ON lm.list_id = el.list_id
      WHERE el.event_id = events.id AND lm.member_id = auth.uid()
    )
  );