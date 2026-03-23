CREATE TABLE IF NOT EXISTS public.wati_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT,
  message_text TEXT,
  phone TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wati_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wati_webhook_events'
      AND policyname = 'No direct access to webhook events'
  ) THEN
    CREATE POLICY "No direct access to webhook events"
    ON public.wati_webhook_events
    FOR ALL
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wati_webhook_events_processed_at
  ON public.wati_webhook_events (processed_at DESC);