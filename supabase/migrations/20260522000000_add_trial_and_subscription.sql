-- Trial Grants: tracks 6-hour free trial per new user
create table public.trial_grants (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  start_time timestamptz not null default now(),
  expiry_time timestamptz not null,
  status text not null default 'active', -- 'active', 'expired', 'converted_to_paid'
  created_at timestamptz not null default now(),
  unique(telegram_id) -- Only one active trial per user
);
create index idx_trial_grants_telegram_id on public.trial_grants(telegram_id);

-- Subscription Durations: admin-controlled expiry dates and hours per userbot
create table public.subscription_durations (
  id uuid primary key default gen_random_uuid(),
  userbot_id uuid not null references public.userbots(id) on delete cascade,
  expiry_date timestamptz not null,
  hours_remaining numeric not null default 0,
  days_remaining numeric not null default 0,
  notes text,
  last_extended_at timestamptz,
  extended_by_admin text, -- admin username for tracking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(userbot_id) -- One subscription record per userbot
);
create index idx_subscription_userbot on public.subscription_durations(userbot_id);
create index idx_subscription_expiry on public.subscription_durations(expiry_date);

-- Enable RLS for new tables
alter table public.trial_grants enable row level security;
alter table public.subscription_durations enable row level security;

-- Add updated_at trigger to subscription_durations
create trigger trg_subscription_durations_updated before update on public.subscription_durations
  for each row execute function public.touch_updated_at();

-- New user first-time connection triggers trial grant (handled via app.functions.ts)
-- Service role required to insert
