import { createClient } from "@/lib/supabase/server"

export type DashboardStats = {
  invoiceCount: number
  documentCount: number
  monthlyRevenue: number
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [invoiceResult, documentResult, revenueResult] = await Promise.all([
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
  ])

  const monthlyRevenue = (revenueResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.total) ?? 0),
    0
  )

  return {
    invoiceCount: invoiceResult.count ?? 0,
    documentCount: documentResult.count ?? 0,
    monthlyRevenue,
  }
}
