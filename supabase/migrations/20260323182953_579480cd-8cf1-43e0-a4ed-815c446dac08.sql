CREATE TABLE IF NOT EXISTS public.focus_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_name, customer_name)
);

ALTER TABLE public.focus_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to focus_customers"
ON public.focus_customers
FOR ALL
USING (true)
WITH CHECK (true);