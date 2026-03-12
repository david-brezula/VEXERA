-- Task 3: Create SQL function for account balances
-- Sprint 3: Ledger & Accounting Engine

CREATE OR REPLACE FUNCTION get_account_balances(
  p_org_id UUID,
  p_year SMALLINT DEFAULT NULL,
  p_month SMALLINT DEFAULT NULL
)
RETURNS TABLE (
  account_number TEXT,
  account_name TEXT,
  account_type TEXT,
  debit_total DECIMAL,
  credit_total DECIMAL,
  balance DECIMAL
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    le.account_number_new AS account_number,
    COALESCE(ca.account_name, le.account_number_new) AS account_name,
    COALESCE(ca.account_type, 'asset') AS account_type,
    COALESCE(SUM(le.debit_amount), 0) AS debit_total,
    COALESCE(SUM(le.credit_amount), 0) AS credit_total,
    COALESCE(SUM(le.debit_amount), 0) - COALESCE(SUM(le.credit_amount), 0) AS balance
  FROM ledger_entries le
  JOIN journal_entries je ON je.id = le.journal_entry_id
  LEFT JOIN chart_of_accounts ca
    ON ca.account_number = le.account_number_new
    AND (ca.organization_id = p_org_id OR ca.organization_id IS NULL)
  WHERE je.organization_id = p_org_id
    AND je.status = 'posted'
    AND (p_year IS NULL OR je.period_year = p_year)
    AND (p_month IS NULL OR je.period_month = p_month)
  GROUP BY le.account_number_new, ca.account_name, ca.account_type
  ORDER BY le.account_number_new;
$$;
