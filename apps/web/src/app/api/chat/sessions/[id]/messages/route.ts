/**
 * GET /api/chat/sessions/[id]/messages — list messages for a chat session
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSessionMessages } from "@/features/chat/service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: sessionId } = await params

    // Verify the session belongs to this user
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .single()

    const sessionRecord = session as unknown as { id: string; user_id: string } | null
    if (!sessionRecord || sessionRecord.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const messages = await getSessionMessages(supabase, sessionId)
    return NextResponse.json({ data: messages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
