import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function getActiveOrgId(): Promise<string | null> {
  const store = await cookies()
  return store.get("active_organization_id")?.value ?? null
}

export interface ActiveOrg {
  id: string
  organization_type: string
}

export async function getActiveOrg(): Promise<ActiveOrg | null> {
  const orgId = await getActiveOrgId()
  if (!orgId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("organizations")
    .select("id, organization_type")
    .eq("id", orgId)
    .single()

  return data as ActiveOrg | null
}
