
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
  IF target_privacy IS NULL OR target_privacy = 'open' THEN
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_accept_follow() FROM PUBLIC, anon, authenticated;
