-- Archive Policies & Retention
-- Configures document retention periods per type for legal compliance.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.archive_policies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Policy config
  document_type   text not null,           -- invoice_received, invoice_issued, receipt, bank_statement, etc.
  retention_years int not null default 10,
  auto_archive    boolean not null default true,
  notify_before_expiry_days int not null default 30,

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Each org has one policy per document_type
  unique (organization_id, document_type)
);

-- Indexes
create index if not exists idx_archive_policies_org
  on public.archive_policies(organization_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.archive_policies enable row level security;

create policy "Users can view archive policies for their orgs"
  on public.archive_policies for select
  using (organization_id = ANY(public.get_accessible_organization_ids()));

create policy "Users can insert archive policies for their orgs"
  on public.archive_policies for insert
  with check (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can update archive policies for their orgs"
  on public.archive_policies for update
  using (organization_id = ANY(public.get_user_organization_ids()));

create policy "Users can delete archive policies for their orgs"
  on public.archive_policies for delete
  using (organization_id = ANY(public.get_user_organization_ids()));

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create trigger set_archive_policies_updated_at
  before update on public.archive_policies
  for each row
  execute function public.update_updated_at_column();
