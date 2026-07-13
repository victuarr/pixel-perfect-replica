CREATE OR REPLACE FUNCTION public.can_view_event(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Reminder column on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_minutes integer;

-- Reminders sent tracker
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.event_reminders TO authenticated;
GRANT ALL ON public.event_reminders TO service_role;

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
ON public.event_reminders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reminders"
ON public.event_reminders FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Comments
CREATE TABLE IF NOT EXISTS public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;
GRANT ALL ON public.event_comments TO service_role;

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments visible to users who can view the event"
ON public.event_comments FOR SELECT
TO authenticated
USING (public.can_view_event(event_id, auth.uid()));

CREATE POLICY "Users can comment on events they can view"
ON public.event_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_event(event_id, auth.uid())
);

CREATE POLICY "Users can edit their own comments"
ON public.event_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.event_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Reactions
CREATE TABLE IF NOT EXISTS public.event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, reaction)
);

GRANT SELECT, INSERT, DELETE ON public.event_reactions TO authenticated;
GRANT ALL ON public.event_reactions TO service_role;

ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions visible to users who can view the event"
ON public.event_reactions FOR SELECT
TO authenticated
USING (public.can_view_event(event_id, auth.uid()));

CREATE POLICY "Users can react on events they can view"
ON public.event_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_view_event(event_id, auth.uid())
);

CREATE POLICY "Users can delete their own reactions"
ON public.event_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger for comments
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_event_comments_updated_at ON public.event_comments;
CREATE TRIGGER update_event_comments_updated_at
BEFORE UPDATE ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification types
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_reminder';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_reaction';

-- Notification trigger for comments and reactions
CREATE OR REPLACE FUNCTION public.notify_event_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _type notification_type;
  _data jsonb;
BEGIN
  _type := TG_ARGV[0];
  SELECT owner_id INTO _owner_id FROM public.events WHERE id = NEW.event_id;
  IF _owner_id IS NULL OR _owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF _type = 'event_comment' THEN
    _data := jsonb_build_object('body', left(NEW.body, 80));
  ELSIF _type = 'event_reaction' THEN
    _data := jsonb_build_object('reaction', NEW.reaction);
  ELSE
    _data := '{}'::jsonb;
  END IF;

  INSERT INTO public.notifications(user_id, actor_id, type, entity_type, entity_id, data)
  VALUES (_owner_id, NEW.user_id, _type, 'event', NEW.event_id, _data);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_comment ON public.event_comments;
CREATE TRIGGER trg_notify_event_comment
AFTER INSERT ON public.event_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_activity('event_comment');

DROP TRIGGER IF EXISTS trg_notify_event_reaction ON public.event_reactions;
CREATE TRIGGER trg_notify_event_reaction
AFTER INSERT ON public.event_reactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_activity('event_reaction');

-- Add realtime for comments and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reminders;