-- Contacts / Client Directory
-- Stores client and supplier contact information with auto-fill from Slovak registers.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Company info
  name            text not null,
  ico             text,                    -- Slovak IČO (company ID)
  dic             text,                    -- DIČ (tax ID)
  ic_dph          text,                    -- IČ DPH (VAT ID)
  contact_type    text not null default 'client'
                  check (contact_type in ('client', 'supplier', 'both')),

  -- Address
  street          text,
  city            text,
  postal_code     text,
  country         text default 'SK',

  -- Contact details
  email           text,
  phone           text,
  website         text,
  bank_account    text,                    -- IBAN

  -- Flags
  is_key_client   boolean not null default false,
  notes           text,

  -- Stats (updated periodically)
  total_invoiced  numeric(14,2) default 0,
  invoice_count   int default 0,
  avg_payment_days int,

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Indexes
create index if not exists idx_contacts_org
  on public.contacts(organization_id);

create index if not exists idx_contacts_ico
  on public.contacts(organization_id, ico) where ico is not null;

create index if not exists idx_contacts_name
  on public.contacts(organization_id, name);

create index if not exists idx_contacts_type
  on public.contacts(organization_id, contact_type);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.contacts enable row level security;

create policy "Users can view contacts for their orgs"
  on public.contacts for select
  using (organization_id = ANY(public.get_accessible_organization_ids()));

create policy "Users can insert contacts for their orgs"
  on public.contacts for insert
  with check (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can update contacts for their orgs"
  on public.contacts for update
  using (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can delete contacts for their orgs"
  on public.contacts for delete
  using (organization_id = ANY(public.get_user_organization_ids()));

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.update_updated_at_column();
