
-- follows: social graph with optional approval for private profiles
CREATE TYPE public.follow_status AS ENUM ('pending','accepted');

CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.follow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX follows_follower_idx ON public.follows(follower_id, status);
CREATE INDEX follows_followee_idx ON public.follows(followee_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Both parties can see the edge
CREATE POLICY "Follower or followee can view follow"
ON public.follows FOR SELECT TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- Only the follower creates the request
CREATE POLICY "User can request to follow"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);

-- Followee can accept / update status; follower cannot change status
CREATE POLICY "Followee can update status"
ON public.follows FOR UPDATE TO authenticated
USING (auth.uid() = followee_id)
WITH CHECK (auth.uid() = followee_id);

-- Follower can unfollow, followee can remove a follower
CREATE POLICY "Follower or followee can delete"
ON public.follows FOR DELETE TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- Auto-accept follow requests when target profile is public
CREATE OR REPLACE FUNCTION public.auto_accept_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_privacy TEXT;
BEGIN
  SELECT profile_privacy::text INTO target_privacy
  FROM public.profiles WHERE id = NEW.followee_id;
  IF target_privacy = 'public' OR target_privacy IS NULL THEN
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER follows_auto_accept
BEFORE INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.auto_accept_follow();

CREATE TRIGGER follows_set_updated_at
BEFORE UPDATE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
