/**
 * GET  /api/contacts — list contacts for an organization
 * POST /api/contacts — create a new contact
 *
 * Query params (GET):
 *   organization_id — required
 *   type — optional: "client" | "supplier" | "both"
 *   search — optional: name/ICO search
 *   key_only — optional: "true" for key clients only
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { listContacts, createContact } from "@/lib/services/contacts.service"
import { writeAuditLog } from "@/lib/services/audit.server"

const createSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  ico: z.string().nullish(),
  dic: z.string().nullish(),
  ic_dph: z.string().nullish(),
  contact_type: z.enum(["client", "supplier", "both"]).default("client"),
  street: z.string().nullish(),
  city: z.string().nullish(),
  postal_code: z.string().nullish(),
  country: z.string().default("SK"),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  bank_account: z.string().nullish(),
  is_key_client: z.boolean().default(false),
  notes: z.string().nullish(),
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

    const type = url.searchParams.get("type") as "client" | "supplier" | "both" | null
    const search = url.searchParams.get("search") ?? undefined
    const keyOnly = url.searchParams.get("key_only") === "true"

    const contacts = await listContacts(supabase, organizationId, {
      type: type ?? undefined,
      search,
      keyOnly,
    })

    return NextResponse.json({ data: contacts })
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
    const contact = await createContact(supabase, organization_id, input)

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      newData: input as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
