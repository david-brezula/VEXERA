/**
 * GET    /api/contacts/[id] — get a single contact
 * PATCH  /api/contacts/[id] — update a contact
 * DELETE /api/contacts/[id] — soft-delete a contact
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getContact, updateContact, deleteContact } from "@/features/contacts/service"
import { writeAuditLog } from "@/shared/services/audit.server"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

const contactUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ico: z.string().optional().nullable(),
  dic: z.string().optional().nullable(),
  ic_dph: z.string().optional().nullable(),
  contact_type: z.enum(["supplier", "client", "both"]).optional(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  is_key_client: z.boolean().optional(),
  notes: z.string().optional().nullable(),
}).strict()

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
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
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
    const rawBody = await request.json()

    const parsed = contactUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const body = parsed.data

    const { data: existing } = await supabase
      .from("contacts")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
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
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
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
