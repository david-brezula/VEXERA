import { createClient } from "@/lib/supabase/server"

export type DashboardStats = {
  invoiceCount: number
  documentCount: number
  monthlyRevenue: number
  overdueCount: number
  overdueAmount: number
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const today = new Date().toISOString().split("T")[0]

  const [invoiceResult, documentResult, revenueResult, overdueResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null),

    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null),

    supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString())
      .is("deleted_at", null),

    // Use a single condition that covers both "sent past due" and "overdue" status
    // to avoid inconsistency depending on when the status updater last ran
    supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .or(`status.eq.overdue,and(status.eq.sent,due_date.lt.${today})`)
      .is("deleted_at", null),
  ])

  const monthlyRevenue = (revenueResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.total) ?? 0),
    0
  )

  const overdueRows = overdueResult.data ?? []
  const overdueAmount = overdueRows.reduce(
    (sum, row) => sum + (Number(row.total) ?? 0),
    0
  )

  return {
    invoiceCount: invoiceResult.count ?? 0,
    documentCount: documentResult.count ?? 0,
    monthlyRevenue,
    overdueCount: overdueRows.length,
    overdueAmount,
  }
}
