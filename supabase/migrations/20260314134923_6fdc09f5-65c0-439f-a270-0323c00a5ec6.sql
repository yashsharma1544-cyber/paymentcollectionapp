
CREATE TABLE public.prediction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  predictions jsonb NOT NULL,
  total_predicted numeric NOT NULL DEFAULT 0,
  high_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  low_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prediction_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to prediction_snapshots"
ON public.prediction_snapshots
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
