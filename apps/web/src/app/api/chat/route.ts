/**
 * POST /api/chat — send a message and get AI response
 *
 * Body: { organization_id, message, session_id?, stream? }
 *
 * When `stream: true`, returns an SSE stream from the Anthropic API
 * and saves the complete message after streaming finishes.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  processQuery,
  getOrCreateSession,
  saveMessage,
  buildOrgContext,
  fetchRelevantData,
} from "@/lib/services/ai-chat.service"

const ChatSchema = z.object({
  organization_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  session_id: z.string().uuid().optional(),
  stream: z.boolean().optional(),
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

    const { organization_id, message, session_id, stream } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // ── Non-streaming path (backward compatible) ──────────────────────────
    if (!stream) {
      const result = await processQuery(
        supabase,
        organization_id,
        user.id,
        message,
        session_id
      )
      return NextResponse.json({ data: result })
    }

    // ── Streaming path ────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI chatbot nie je nakonfigurovaný." },
        { status: 500 }
      )
    }

    // Session + user message + context (shared logic)
    const sessionId = await getOrCreateSession(supabase, organization_id, user.id, session_id)
    await saveMessage(supabase, sessionId, "user", message)

    const orgContext = await buildOrgContext(supabase, organization_id)
    const relevantData = await fetchRelevantData(supabase, organization_id, message)

    // Conversation history
    const { data: historyData } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10)

    const history = (historyData ?? []) as unknown as { role: string; content: string }[]

    const systemPrompt = `You are a helpful financial assistant for the company described below. Answer questions about their financial data in Slovak language. Be concise, use numbers and tables when appropriate. Format currency amounts with 2 decimal places.

IMPORTANT RULES:
- Only use the data provided below to answer questions. Do not make up numbers.
- If you don't have enough data to answer precisely, say so.
- Never suggest actions that modify data.
- Always respond in Slovak language.

${orgContext}

${relevantData ? `\nRelevant financial data:\n${relevantData}` : ""}`

    const conversationMessages = history
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationMessages,
        stream: true,
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error("[ai-chat] Claude streaming API error:", errorText)
      return NextResponse.json(
        { error: "AI request failed" },
        { status: 502 }
      )
    }

    let fullText = ""
    // We need to capture supabase/sessionId in closure for saving after stream
    const capturedSupabase = supabase
    const capturedSessionId = sessionId

    const responseStream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body!.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            controller.enqueue(new TextEncoder().encode(chunk))
            // Parse SSE to collect full text
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type === "content_block_delta" && data.delta?.text) {
                    fullText += data.delta.text
                  }
                } catch {
                  // ignore non-JSON data lines like [DONE]
                }
              }
            }
          }
        } finally {
          controller.close()
          // Save complete message to DB after stream ends
          if (fullText) {
            await saveMessage(capturedSupabase, capturedSessionId, "assistant", fullText, {
              model: "claude-sonnet-4-6",
              streamed: true,
            })

            // Update session title if it's the first message
            const { data: sessionData } = await capturedSupabase
              .from("chat_sessions")
              .select("title")
              .eq("id", capturedSessionId)
              .single()

            if (!(sessionData as unknown as { title: string | null })?.title) {
              const title = message.length > 50 ? message.slice(0, 47) + "..." : message
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (capturedSupabase.from("chat_sessions" as any) as any)
                .update({ title })
                .eq("id", capturedSessionId)
            }
          }
        }
      },
    })

    // Return session ID in a custom header so the client can track the session
    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-Id": capturedSessionId,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
