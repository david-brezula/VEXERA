/**
 * GET    /api/products/[id] — get a single product
 * PATCH  /api/products/[id] — update a product
 * DELETE /api/products/[id] — soft-delete a product
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getProduct, updateProduct, deleteProduct } from "@/features/products/service"
import { writeAuditLog } from "@/shared/services/audit.server"
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

    const { data } = await supabase
      .from("products")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (data as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
    const product = await getProduct(supabase, orgId, id)
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ data: product })
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
      .from("products")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
    const product = await updateProduct(supabase, orgId, id, body)

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      newData: body as Record<string, unknown>,
    })

    return NextResponse.json({ data: product })
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
      .from("products")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
    await deleteProduct(supabase, orgId, id)

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "product.deleted",
      entityType: "product",
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
