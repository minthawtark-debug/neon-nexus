-- Enums
create type public.app_role as enum ('admin', 'user');
create type public.target_type as enum ('channel', 'group');
create type public.forward_status as enum ('success', 'failed', 'skipped');

-- Profiles: keyed by Telegram user id
create table public.profiles (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  role public.app_role not null,
  unique (telegram_id, role)
);

-- has_role helper (security definer to avoid RLS recursion)
create or replace function public.has_role(_telegram_id bigint, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where telegram_id = _telegram_id and role = _role
  )
$$;

-- Userbots
create table public.userbots (
  id uuid primary key default gen_random_uuid(),
  owner_telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  username text,
  phone text,
  session_string text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_userbots_owner on public.userbots(owner_telegram_id);

-- Forward targets
create table public.forward_targets (
  id uuid primary key default gen_random_uuid(),
  userbot_id uuid not null references public.userbots(id) on delete cascade,
  target_link text not null,
  target_type public.target_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_targets_userbot on public.forward_targets(userbot_id);

-- Forward events (log)
create table public.forward_events (
  id uuid primary key default gen_random_uuid(),
  userbot_id uuid not null references public.userbots(id) on delete cascade,
  target_id uuid references public.forward_targets(id) on delete set null,
  status public.forward_status not null,
  created_at timestamptz not null default now()
);
create index idx_events_userbot_time on public.forward_events(userbot_id, created_at desc);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_userbots_updated before update on public.userbots
  for each row execute function public.touch_updated_at();

-- Enable RLS, deny all from client (access via service role in server fns only)
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.userbots enable row level security;
alter table public.forward_targets enable row level security;
alter table public.forward_events enable row level security;

-- Seed admin role for @Wolf_002196 (placeholder id; real id is bound when they first open the app)
-- Admin promotion happens automatically in the auth server fn based on username.