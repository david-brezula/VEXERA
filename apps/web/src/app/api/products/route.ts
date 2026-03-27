/**
 * GET  /api/products — list products for an organization
 * POST /api/products — create a new product
 *
 * Query params (GET):
 *   organization_id — required
 *   active_only — optional: "true"
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { listProducts, createProduct } from "@/features/products/service"
import { writeAuditLog } from "@/shared/services/audit.server"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

const createSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  sku: z.string().nullish(),
  unit: z.string().default("ks"),
  unit_price_net: z.number().min(0),
  vat_rate: z.number().min(0).max(100).default(23),
  currency: z.string().default("EUR"),
  is_active: z.boolean().default(true),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const membership = await verifyOrgMembership(supabase, user.id, organizationId)
    if (!membership) return forbiddenResponse()

    const activeOnly = url.searchParams.get("active_only") === "true"
    const products = await listProducts(supabase, organizationId, activeOnly)

    return NextResponse.json({ data: products })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { organization_id, ...input } = parsed.data

    const membership = await verifyOrgMembership(supabase, user.id, organization_id)
    if (!membership) return forbiddenResponse()

    const product = await createProduct(supabase, organization_id, input)

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      newData: input as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
