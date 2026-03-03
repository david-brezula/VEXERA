CREATE TABLE IF NOT EXISTS accountant_clients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invitation_id    UUID REFERENCES invitations(id),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('pending', 'active', 'revoked')),
  permissions      JSONB NOT NULL DEFAULT '{
    "view_invoices": true,
    "close_invoices": true,
    "manage_ledger": true,
    "view_documents": true,
    "upload_documents": false
  }'::jsonb,
  accepted_at      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (accountant_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_acc_clients_accountant ON accountant_clients(accountant_id);
CREATE INDEX IF NOT EXISTS idx_acc_clients_org        ON accountant_clients(organization_id);
