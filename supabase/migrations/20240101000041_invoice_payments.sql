-- Invoice Payments — Partial Payments & Overpayments
-- Tracks individual payments per invoice, enabling partial payment support.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.invoice_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,

  -- Payment details
  amount          numeric(14,2) not null,
  currency        text not null default 'EUR',
  payment_date    date not null default current_date,
  payment_method  text default 'bank_transfer'
                  check (payment_method in ('bank_transfer', 'cash', 'card', 'other')),
  reference       text,                    -- variable symbol, transaction ref

  -- Linked bank transaction (optional)
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,

  -- Notes
  notes           text,

  -- Timestamps
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_invoice_payments_org
  on public.invoice_payments(organization_id);

create index if not exists idx_invoice_payments_invoice
  on public.invoice_payments(invoice_id);

-- ─── Add paid_amount and remaining_amount to invoices ───────────────────────

alter table public.invoices
  add column if not exists paid_amount numeric(14,2) not null default 0,
  add column if not exists remaining_amount numeric(14,2);

-- Initialize remaining_amount = total_amount - paid_amount
update public.invoices
  set remaining_amount = coalesce(total, 0) - paid_amount
  where remaining_amount is null;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.invoice_payments enable row level security;

create policy "Users can view payments for their orgs"
  on public.invoice_payments for select
  using (organization_id in (select public.get_accessible_organization_ids()));

create policy "Users can insert payments for their orgs"
  on public.invoice_payments for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Users can update payments for their orgs"
  on public.invoice_payments for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Users can delete payments for their orgs"
  on public.invoice_payments for delete
  using (organization_id in (select public.get_user_organization_ids()));
