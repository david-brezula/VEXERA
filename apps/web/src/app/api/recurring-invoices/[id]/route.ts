/**
 * GET    /api/recurring-invoices/[id] — get template detail
 * PATCH  /api/recurring-invoices/[id] — update template
 * DELETE /api/recurring-invoices/[id] — delete template
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateTemplate, deleteTemplate } from "@/features/invoices/recurring.service"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase
      .from("recurring_invoice_templates")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (data as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    // Verify org membership before update
    const { data: existing } = await supabase
      .from("recurring_invoice_templates")
      .select("organization_id")
      .eq("id", id)
      .single()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()

    const success = await updateTemplate(supabase, id, body)
    if (!success) {
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
    }

    return NextResponse.json({ data: { updated: true } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    // Verify org membership before delete
    const { data: existing } = await supabase
      .from("recurring_invoice_templates")
      .select("organization_id")
      .eq("id", id)
      .single()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()

    const success = await deleteTemplate(supabase, id)
    if (!success) {
      return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
