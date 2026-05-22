-- migrate: create public.proxies

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.proxies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_text text NOT NULL UNIQUE,
    ip text NOT NULL,
    port integer NOT NULL,
    username text NULL,
    password text NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_tested_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index optimized for worker pool query
CREATE INDEX IF NOT EXISTS idx_proxies_active_tested_at ON public.proxies (is_active, last_tested_at ASC NULLS FIRST);
