CREATE TABLE public.proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text text NOT NULL UNIQUE,
  ip text NOT NULL,
  port integer NOT NULL,
  username text,
  password text,
  is_active boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxies_active_tested ON public.proxies (is_active, last_tested_at ASC NULLS FIRST);

ALTER TABLE public.proxies ENABLE ROW LEVEL SECURITY;

-- No public policies: all access goes through server functions using the service-role client.
COMMENT ON TABLE public.proxies IS 'Proxy pool ingested from t.me/V_Usproxy1. Accessed only via service-role server functions.';