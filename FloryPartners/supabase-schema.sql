-- Flory Partners production schema
create extension if not exists pgcrypto;

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  name text not null,
  email text unique not null,
  country text,
  city text,
  commission_percent numeric(5,2) not null default 75,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique,
  order_number text not null,
  partner_id uuid references partners(id),
  customer_email text,
  customer_name text,
  recipient_name text,
  delivery_city text,
  delivery_address text,
  delivery_date date,
  product_name text not null,
  quantity int not null default 1,
  total_amount numeric(12,2) not null,
  currency text not null default 'RON',
  card_message text,
  status text not null default 'NEW'
    check (status in ('NEW','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','DECLINED')),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table partners enable row level security;
alter table orders enable row level security;
alter table order_events enable row level security;

create policy "partner reads own profile" on partners
for select using (auth.uid() = user_id);

create policy "partner reads assigned orders" on orders
for select using (
  partner_id in (select id from partners where user_id = auth.uid() and active = true)
);

create policy "partner updates assigned orders" on orders
for update using (
  partner_id in (select id from partners where user_id = auth.uid() and active = true)
);

create policy "partner reads own order events" on order_events
for select using (
  order_id in (
    select o.id from orders o
    join partners p on p.id=o.partner_id
    where p.user_id=auth.uid() and p.active=true
  )
);
