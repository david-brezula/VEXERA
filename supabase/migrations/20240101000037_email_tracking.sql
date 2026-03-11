-- Email Tracking
-- Tracks email delivery and open status for invoice emails.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.email_tracking (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id      uuid references public.invoices(id) on delete set null,
  recipient_email text not null,
  subject         text,
  tracking_pixel_id uuid not null default gen_random_uuid(),
  status          text not null default 'sent'
                  check (status in ('pending', 'sent', 'delivered', 'opened', 'failed')),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  open_count      int not null default 0,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_email_tracking_org
  on public.email_tracking(organization_id);

create index if not exists idx_email_tracking_invoice
  on public.email_tracking(invoice_id);

create unique index if not exists idx_email_tracking_pixel
  on public.email_tracking(tracking_pixel_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.email_tracking enable row level security;

create policy "Users can view email tracking for their orgs"
  on public.email_tracking for select
  using (organization_id in (select public.get_accessible_organization_ids()));

create policy "Users can insert email tracking for their orgs"
  on public.email_tracking for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Users can update email tracking for their orgs"
  on public.email_tracking for update
  using (organization_id in (select public.get_user_organization_ids()));

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create trigger set_email_tracking_updated_at
  before update on public.email_tracking
  for each row
  execute function public.set_updated_at();
