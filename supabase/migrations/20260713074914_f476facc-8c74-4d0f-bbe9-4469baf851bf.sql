CREATE TYPE public.event_visibility AS ENUM ('public', 'lists', 'private');

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT,
  place TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  description TEXT,
  visibility_type public.event_visibility NOT NULL DEFAULT 'private',
  origin_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  list_color TEXT NOT NULL DEFAULT '#3B7BF0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Phase 2: only owner reads/writes. Phase 3 will add public/lists visibility policies.
CREATE POLICY "Owner can view own events" ON public.events
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Owner can insert own events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own events" ON public.events
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own events" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX events_owner_starts_idx ON public.events (owner_id, starts_at);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();