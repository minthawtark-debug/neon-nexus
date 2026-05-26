-- Products table: stores digital goods for sale
create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'software', -- 'premium', 'gaming', 'software'
  price numeric(10, 2) not null,
  stock integer not null default 0,
  icon text not null default 'Sparkles', -- Icon component name
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_category on public.products(category);
create index idx_products_active on public.products(is_active);
create index idx_products_sort on public.products(sort_order);

-- Enable RLS for products
alter table public.products enable row level security;

-- updated_at trigger for products
create trigger trg_products_updated before update on public.products
  for each row execute function public.touch_updated_at();

-- Seed initial products
insert into public.products (title, description, category, price, stock, icon, sort_order) values
  ('Telegram Premium 3M', '3-month Telegram Premium subscription', 'premium', 14.99, 42, 'Crown', 1),
  ('Telegram Premium 12M', '12-month Telegram Premium subscription', 'premium', 39.99, 18, 'Crown', 2),
  ('Valorant Smurf Acc', 'Fresh Valorant smurf account with email', 'gaming', 7.50, 60, 'Gamepad2', 3),
  ('Steam Wallet $25', 'Steam Wallet credit code ($25 value)', 'gaming', 22.00, 0, 'Gamepad2', 4),
  ('Windows 11 Pro Key', 'Original Windows 11 Pro license key', 'software', 9.99, 230, 'KeySquare', 5),
  ('Office 365 Family', '12-month Office 365 Family subscription', 'software', 19.99, 12, 'KeySquare', 6);
