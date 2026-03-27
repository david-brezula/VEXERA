/**
 * POST /api/analytics — record an analytics event
 *
 * Body: { event_name: string, organization_id?: string, properties?: object }
 *
 * Lightweight endpoint — no org membership check required.
 * The event is recorded with the authenticated user's ID.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { trackEvent } from "@/features/reports/analytics.service"

const EventSchema = z.object({
  event_name: z.string().min(1).max(200),
  organization_id: z.string().uuid().nullable().optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = EventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await trackEvent(supabase, {
      eventName: parsed.data.event_name,
      organizationId: parsed.data.organization_id,
      userId: user.id,
      properties: parsed.data.properties,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
