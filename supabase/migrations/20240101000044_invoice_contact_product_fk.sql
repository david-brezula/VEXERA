-- Add contact_id FK to invoices (optional — snapshot fields remain)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add product_id FK to invoice_items (optional — snapshot fields remain)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Add credit note FK to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_note_for_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Update invoice_type check to include credit_note
ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_invoice_type_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('issued', 'received', 'credit_note'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for_id ON public.invoices(credit_note_for_id);
