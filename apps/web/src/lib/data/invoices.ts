import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"
import { paginationRange, type PaginationParams, type PaginatedResult } from "./pagination"
import type { InvoiceStatus, InvoiceType, Database } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceDetail = Database["public"]["Tables"]["invoices"]["Row"] & {
  invoice_items: Database["public"]["Tables"]["invoice_items"]["Row"][]
  organization?: { logo_url: string | null } | null
}

export type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_type: InvoiceType
  status: InvoiceStatus
  supplier_name: string
  customer_name: string
  issue_date: string
  due_date: string
  total: number
  currency: string
  created_at: string
}

export type InvoiceFilters = {
  status?: InvoiceStatus | "all"
  invoice_type?: InvoiceType | "all"
  search?: string
  date_from?: string
  date_to?: string
}

// ─── getInvoices ──────────────────────────────────────────────────────────────

export async function getInvoices(
  filters?: InvoiceFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<InvoiceRow>> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }

  const { from, to, page, pageSize } = paginationRange(pagination)

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_type, status, supplier_name, customer_name, issue_date, due_date, total, currency, created_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (filters?.status && filters.status !== "all") {
    if (filters.status === "overdue") {
      query = query.eq("status", "sent").lt("due_date", new Date().toISOString().slice(0, 10))
    } else {
      query = query.eq("status", filters.status)
    }
  }
  if (filters?.invoice_type && filters.invoice_type !== "all") {
    query = query.eq("invoice_type", filters.invoice_type)
  }
  if (filters?.search) {
    query = query.or(
      `invoice_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
    )
  }
  if (filters?.date_from) {
    query = query.gte("issue_date", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("issue_date", filters.date_to)
  }

  const { data, error, count } = await query
  if (error) throw error

  const total = count ?? 0
  const today = new Date().toISOString().slice(0, 10)
  const rows = (data ?? []).map((inv) => ({
    ...inv,
    status:
      inv.status === "sent" && inv.due_date < today
        ? ("overdue" as InvoiceStatus)
        : (inv.status as InvoiceStatus),
    total: Number(inv.total),
    invoice_type: inv.invoice_type as InvoiceType,
  }))

  return {
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── getInvoice ───────────────────────────────────────────────────────────────

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return null

  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), organization:organizations!organization_id(logo_url)")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .single()

  if (error) return null
  return data as unknown as InvoiceDetail | null
}
