-- Product / Service Catalog
-- Stores reusable products and services for invoicing with revenue stats.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Product info
  name            text not null,
  description     text,
  sku             text,                    -- optional product code
  unit            text default 'ks',       -- ks, hod, m2, etc.
  unit_price_net  numeric(14,2) not null,
  vat_rate        numeric(5,2) not null default 20,
  currency        text not null default 'EUR',

  -- Computed stats (updated periodically)
  total_revenue   numeric(14,2) not null default 0,
  times_invoiced  int not null default 0,

  -- Flags
  is_active       boolean not null default true,

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Indexes
create index if not exists idx_products_org
  on public.products(organization_id);

create index if not exists idx_products_active
  on public.products(organization_id, is_active) where deleted_at is null;

create index if not exists idx_products_name
  on public.products(organization_id, name);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.products enable row level security;

create policy "Users can view products for their orgs"
  on public.products for select
  using (organization_id = ANY(public.get_accessible_organization_ids()));

create policy "Users can insert products for their orgs"
  on public.products for insert
  with check (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can update products for their orgs"
  on public.products for update
  using (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can delete products for their orgs"
  on public.products for delete
  using (organization_id = ANY(public.get_user_organization_ids()));

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.update_updated_at_column();
