DROP POLICY IF EXISTS "Profiles viewable by owner or accepted followers or if open" ON public.profiles;

CREATE POLICY "Profiles are discoverable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);