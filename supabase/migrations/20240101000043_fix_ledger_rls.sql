-- Fix RLS gaps on chart_of_accounts and ledger_entries
-- Adds DELETE policies (SELECT, INSERT, UPDATE already exist in migration 14).

-- chart_of_accounts: allow members to delete non-system accounts for their orgs
CREATE POLICY "coa_delete"
  ON public.chart_of_accounts FOR DELETE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND is_system = FALSE
  );

-- ledger_entries: allow members to delete draft entries only
CREATE POLICY "ledger_delete_draft"
  ON public.ledger_entries FOR DELETE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND status = 'draft'
  );
