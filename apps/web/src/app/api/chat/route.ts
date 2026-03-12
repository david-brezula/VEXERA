/**
 * POST /api/chat — send a message and get AI response
 *
 * Body: { organization_id, message, session_id? }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { processQuery } from "@/lib/services/ai-chat.service"

const ChatSchema = z.object({
  organization_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  session_id: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = ChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { organization_id, message, session_id } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await processQuery(
      supabase,
      organization_id,
      user.id,
      message,
      session_id
    )

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
