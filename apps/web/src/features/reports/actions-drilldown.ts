"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"

export async function getDrilldownDocumentsAction(
  documentIds: string[]
): Promise<{ id: string; name: string; issue_date: string | null; total_amount: number | null; status: string; document_type: string }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId || documentIds.length === 0) return []

  const { data } = await supabase
    .from("documents")
    .select("id, name, issue_date, total_amount, status, document_type")
    .eq("organization_id", orgId)
    .in("id", documentIds.slice(0, 50))
    .order("issue_date", { ascending: false })

  return (data ?? []) as { id: string; name: string; issue_date: string | null; total_amount: number | null; status: string; document_type: string }[]
}
