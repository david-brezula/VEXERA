/**
 * GET    /api/contacts/[id] — get a single contact
 * PATCH  /api/contacts/[id] — update a contact
 * DELETE /api/contacts/[id] — soft-delete a contact
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getContact, updateContact, deleteContact } from "@/lib/services/contacts.service"
import { writeAuditLog } from "@/lib/services/audit.server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    // We need the org_id — get it from the contact itself
    const { data } = await supabase
      .from("contacts")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (data as unknown as { organization_id: string }).organization_id
    const contact = await getContact(supabase, orgId, id)
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ data: contact })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
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

    const { data: existing } = await supabase
      .from("contacts")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const contact = await updateContact(supabase, orgId, id, body)

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "contact.updated",
      entityType: "contact",
      entityId: id,
      newData: body as Record<string, unknown>,
    })

    return NextResponse.json({ data: contact })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
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

    const { data: existing } = await supabase
      .from("contacts")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    await deleteContact(supabase, orgId, id)

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "contact.deleted",
      entityType: "contact",
      entityId: id,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
