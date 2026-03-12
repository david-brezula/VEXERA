/**
 * GET  /api/tags — list tags for an organization
 * POST /api/tags — create a new tag
 *
 * GET query params:
 *   organization_id — required
 *   tag_type        — optional: "client" | "project" | "custom"
 *
 * POST body: { organization_id, name, tag_type, color? }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createTag, listTags } from "@/lib/services/tags.service"
import type { TagType } from "@/lib/services/tags.service"

const CreateTagSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  tag_type: z.enum(["client", "project", "custom"]),
  color: z.string().max(7).optional(),
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

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const tagType = url.searchParams.get("tag_type") as TagType | undefined
    const data = await listTags(supabase, organizationId, tagType ?? undefined)

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateTagSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { organization_id, ...fields } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const tag = await createTag(supabase, organization_id, {
      name: fields.name,
      tagType: fields.tag_type,
      color: fields.color,
    })

    if (!tag) return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })

    return NextResponse.json({ data: tag }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
