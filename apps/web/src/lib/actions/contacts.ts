"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { listContacts, type Contact } from "@/lib/services/contacts.service"

export async function searchContactsAction(
  search: string,
  type: "client" | "supplier"
): Promise<Contact[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listContacts(supabase, orgId, { type, search }, 20)
}
