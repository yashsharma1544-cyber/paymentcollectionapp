CREATE TABLE public.ai_insights_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL,
  content jsonb NOT NULL,
  raw_stats jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  tokens_used integer DEFAULT 0
);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai insights cache"
ON public.ai_insights_cache FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert ai insights cache"
ON public.ai_insights_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update ai insights cache"
ON public.ai_insights_cache FOR UPDATE
USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_insights_expires ON public.ai_insights_cache(expires_at);