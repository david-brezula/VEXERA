/**
 * Contacts Service
 *
 * CRUD operations for client/supplier contacts with auto-import
 * from existing invoices and statistics calculation.
 *
 * Usage:
 *   const contacts = await listContacts(supabase, orgId, { type: "client" })
 *   const contact = await createContact(supabase, orgId, data)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  organization_id: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  contact_type: "client" | "supplier" | "both"
  street: string | null
  city: string | null
  postal_code: string | null
  country: string
  email: string | null
  phone: string | null
  website: string | null
  bank_account: string | null
  is_key_client: boolean
  notes: string | null
  total_invoiced: number
  invoice_count: number
  avg_payment_days: number | null
  created_at: string
  updated_at: string
}

export interface CreateContactInput {
  name: string
  ico?: string | null
  dic?: string | null
  ic_dph?: string | null
  contact_type?: "client" | "supplier" | "both"
  street?: string | null
  city?: string | null
  postal_code?: string | null
  country?: string
  email?: string | null
  phone?: string | null
  website?: string | null
  bank_account?: string | null
  is_key_client?: boolean
  notes?: string | null
}

export interface ContactFilters {
  type?: "client" | "supplier" | "both"
  search?: string
  keyOnly?: boolean
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listContacts(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ContactFilters = {},
  limit: number = 100
): Promise<Contact[]> {
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(limit)

  if (filters.type) {
    query = query.or(`contact_type.eq.${filters.type},contact_type.eq.both`)
  }
  if (filters.keyOnly) {
    query = query.eq("is_key_client", true)
  }
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,ico.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as Contact[]
}

export async function getContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null
  return data as Contact
}

export async function createContact(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateContactInput
): Promise<Contact> {
  const { data, error } = await supabase.from("contacts")
    .insert({
      organization_id: organizationId,
      ...input,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create contact: ${error?.message ?? "unknown error"}`)
  }

  return data as Contact
}

export async function updateContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  input: Partial<CreateContactInput>
): Promise<Contact> {
  const { data, error } = await supabase.from("contacts")
    .update(input)
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update contact: ${error?.message ?? "unknown error"}`)
  }

  return data as Contact
}

export async function deleteContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase.from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`)
  }
}

// ─── Auto-import from invoices ──────────────────────────────────────────────

/**
 * Auto-create contacts from existing invoices that don't have a matching contact.
 * Returns the number of contacts created.
 */
export async function importFromInvoices(
  supabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  // Get all unique customer names from invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_name, customer_ico, customer_email")
    .eq("organization_id", organizationId)
    .not("customer_name", "is", null)

  if (!invoices || invoices.length === 0) return 0

  const typedInvoices = invoices as {
    customer_name: string
    customer_ico: string | null
    customer_email: string | null
  }[]

  // Get existing contacts
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("name, ico")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  const existingNames = new Set(
    ((existingContacts ?? []) as { name: string }[])
      .map((c) => c.name.toLowerCase())
  )

  // Deduplicate and filter
  const uniqueCustomers = new Map<string, { name: string; ico: string | null; email: string | null }>()
  for (const inv of typedInvoices) {
    const key = inv.customer_name.toLowerCase()
    if (!existingNames.has(key) && !uniqueCustomers.has(key)) {
      uniqueCustomers.set(key, {
        name: inv.customer_name,
        ico: inv.customer_ico,
        email: inv.customer_email,
      })
    }
  }

  let created = 0
  for (const customer of uniqueCustomers.values()) {
    try {
      await createContact(supabase, organizationId, {
        name: customer.name,
        ico: customer.ico,
        email: customer.email,
        contact_type: "client",
      })
      created++
    } catch {
      // Skip duplicates or errors
    }
  }

  return created
}

// ─── Statistics ─────────────────────────────────────────────────────────────

/**
 * Update computed stats (total_invoiced, invoice_count, avg_payment_days) for a contact.
 */
export async function updateContactStats(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<void> {
  const contact = await getContact(supabase, organizationId, contactId)
  if (!contact) return

  // Find invoices matching this contact by name or ICO
  let query = supabase
    .from("invoices")
    .select("total_amount, issue_date, paid_at")
    .eq("organization_id", organizationId)

  if (contact.ico) {
    query = query.or(`customer_ico.eq.${contact.ico},customer_name.ilike.%${contact.name}%`)
  } else {
    query = query.ilike("customer_name", `%${contact.name}%`)
  }

  const { data: invoices } = await query
  if (!invoices || invoices.length === 0) return

  const typedInvoices = invoices as {
    total_amount: number | null
    issue_date: string | null
    paid_at: string | null
  }[]

  let totalInvoiced = 0
  let paymentDaysSum = 0
  let paymentDaysCount = 0

  for (const inv of typedInvoices) {
    totalInvoiced += inv.total_amount ?? 0
    if (inv.issue_date && inv.paid_at) {
      const days = Math.floor(
        (new Date(inv.paid_at).getTime() - new Date(inv.issue_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (days >= 0) {
        paymentDaysSum += days
        paymentDaysCount++
      }
    }
  }

  const avgPaymentDays = paymentDaysCount > 0 ? Math.round(paymentDaysSum / paymentDaysCount) : null

  await supabase.from("contacts")
    .update({
      total_invoiced: Number(totalInvoiced.toFixed(2)),
      invoice_count: typedInvoices.length,
      avg_payment_days: avgPaymentDays,
    })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
}
