-- Cashflow What-If Scenarios
-- Stores user-created scenarios with adjustments to the base forecast.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.cashflow_scenarios (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Scenario info
  name            text not null,
  description     text,
  color           text default '#2563eb',    -- for chart overlay

  -- Adjustments as JSONB array
  -- Each adjustment: { type: "add_inflow"|"add_outflow"|"delay_payment"|"remove_item",
  --                     amount?: number, days?: number, description?: string, date?: string }
  adjustments     jsonb not null default '[]',

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_cashflow_scenarios_org
  on public.cashflow_scenarios(organization_id);

create index if not exists idx_cashflow_scenarios_user
  on public.cashflow_scenarios(user_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.cashflow_scenarios enable row level security;

create policy "Users can view scenarios for their orgs"
  on public.cashflow_scenarios for select
  using (organization_id in (select public.get_accessible_organization_ids()));

create policy "Users can insert scenarios for their orgs"
  on public.cashflow_scenarios for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Users can update their own scenarios"
  on public.cashflow_scenarios for update
  using (user_id = auth.uid());

create policy "Users can delete their own scenarios"
  on public.cashflow_scenarios for delete
  using (user_id = auth.uid());

-- ─── Updated_at trigger ─────────────────────────────────────────────────────

create trigger set_cashflow_scenarios_updated_at
  before update on public.cashflow_scenarios
  for each row
  execute function public.set_updated_at();
