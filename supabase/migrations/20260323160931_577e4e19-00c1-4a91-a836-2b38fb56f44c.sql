DROP POLICY IF EXISTS "Allow all access to prediction_snapshots" ON public.prediction_snapshots;

CREATE POLICY "Anyone can view prediction snapshots"
ON public.prediction_snapshots
FOR SELECT
USING (true);