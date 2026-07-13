
-- ================================
-- NOTIFICATIONS
-- ================================
CREATE TYPE public.notification_type AS ENUM (
  'follow_request','follow_accepted','event_invite','event_rsvp'
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert notifications as actor" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: follows -> notifications
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id)
      VALUES (NEW.followee_id, NEW.follower_id, 'follow_request', 'follow', NEW.id);
    ELSIF NEW.status = 'accepted' THEN
      -- open profile auto-accept: notify followee of new follower
      INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id)
      VALUES (NEW.followee_id, NEW.follower_id, 'follow_accepted', 'follow', NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id)
    VALUES (NEW.follower_id, NEW.followee_id, 'follow_accepted', 'follow', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_follow
AFTER INSERT OR UPDATE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ================================
-- EVENT INVITES
-- ================================
CREATE TYPE public.invite_status AS ENUM ('pending','going','maybe','declined');

CREATE TABLE public.event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, invitee_id)
);
CREATE INDEX event_invites_invitee_idx ON public.event_invites(invitee_id);
CREATE INDEX event_invites_event_idx ON public.event_invites(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;
GRANT ALL ON public.event_invites TO service_role;

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- helper: is event owner
CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = _user_id);
$$;

CREATE POLICY "invitee sees own invite" ON public.event_invites
  FOR SELECT TO authenticated USING (invitee_id = auth.uid());
CREATE POLICY "owner sees invites" ON public.event_invites
  FOR SELECT TO authenticated USING (public.is_event_owner(event_id, auth.uid()));
CREATE POLICY "owner inserts invites" ON public.event_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_owner(event_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "invitee updates own rsvp" ON public.event_invites
  FOR UPDATE TO authenticated USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid());
CREATE POLICY "owner deletes invites" ON public.event_invites
  FOR DELETE TO authenticated USING (public.is_event_owner(event_id, auth.uid()));

CREATE TRIGGER trg_event_invites_updated_at
BEFORE UPDATE ON public.event_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extra SELECT policy on events: invitees can see events they were invited to
CREATE POLICY "invitees can see invited events" ON public.events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_invites ei
    WHERE ei.event_id = events.id AND ei.invitee_id = auth.uid()
  ));

-- Trigger: invites -> notifications
CREATE OR REPLACE FUNCTION public.notify_on_event_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id)
    VALUES (NEW.invitee_id, NEW.invited_by, 'event_invite', 'event', NEW.event_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'pending' THEN
    SELECT owner_id INTO owner FROM public.events WHERE id = NEW.event_id;
    IF owner IS NOT NULL AND owner <> NEW.invitee_id THEN
      INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id, data)
      VALUES (owner, NEW.invitee_id, 'event_rsvp', 'event', NEW.event_id,
              jsonb_build_object('status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_event_invite
AFTER INSERT OR UPDATE ON public.event_invites
FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_invite();
