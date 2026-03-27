/**
 * POST /api/contacts/import — auto-import contacts from existing invoices
 *
 * Body:
 *   organization_id — required
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { importFromInvoices } from "@/features/contacts/service"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const organizationId = body.organization_id
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const membership = await verifyOrgMembership(supabase, user.id, organizationId)
    if (!membership) return forbiddenResponse()

    const created = await importFromInvoices(supabase, organizationId)
    return NextResponse.json({ data: { created } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
