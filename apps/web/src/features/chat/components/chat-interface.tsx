"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, History, Plus, X } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Separator } from "@/shared/components/ui/separator"
import { ChatMessage, ChatMessageSkeleton } from "./chat-message"
import { ChatInput } from "./chat-input"
import { ChatSuggestionChips } from "./chat-suggestion-chips"
import { toast } from "sonner"
import { useChatSessions } from "../hooks"
import { useOrganization } from "@/providers/organization-provider"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/shared/lib/query-keys"
import type { ChatMessage as ChatMessageType } from "../service"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  pageContext?: {
    type: "invoice" | "document" | "transaction"
    id: string
    summary: string
  }
}

interface MessageItem {
  role: "user" | "assistant"
  content: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatInterface({ pageContext }: ChatInterfaceProps) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [isFirstMessage, setIsFirstMessage] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: sessions } = useChatSessions()

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText, isStreaming])

  // Load a past session
  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${id}/messages`)
      if (!res.ok) {
        toast.error("Failed to send message")
        return
      }
      const result = (await res.json()) as { data: ChatMessageType[] }
      setSessionId(id)
      setMessages(
        result.data
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
      )
      setIsFirstMessage(false)
      setShowHistory(false)
    } catch {
      toast.error("Failed to load chat sessions")
    }
  }, [])

  // New session
  const newSession = useCallback(() => {
    setSessionId(null)
    setMessages([])
    setStreamingText("")
    setIsStreaming(false)
    setIsFirstMessage(true)
    setShowHistory(false)
  }, [])

  // Send message with streaming
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming || !orgId) return

      // If page context is set and this is the first message, prepend context
      let messageToSend = userMessage
      if (pageContext && isFirstMessage) {
        messageToSend = `[Context: viewing ${pageContext.type} — ${pageContext.summary}]\n\n${userMessage}`
      }

      // Add user message to UI
      setMessages((prev) => [...prev, { role: "user", content: userMessage }])
      setIsStreaming(true)
      setStreamingText("")
      setIsFirstMessage(false)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: orgId,
            message: messageToSend,
            session_id: sessionId ?? undefined,
            stream: true,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? "Request failed")
        }

        // Capture session ID from header
        const newSessionId = res.headers.get("X-Session-Id")
        if (newSessionId) {
          setSessionId(newSessionId)
        }

        // Read SSE stream
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === "content_block_delta" && data.delta?.text) {
                  accumulated += data.delta.text
                  setStreamingText(accumulated)
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          }
        }

        // Stream complete — add the full assistant message
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ])
        }

        // Invalidate sessions list to pick up new/updated session
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(orgId) })
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Prepacte, nastala chyba pri spracovani otazky. Skuste to prosim znova.",
            },
          ])
        }
      } finally {
        setIsStreaming(false)
        setStreamingText("")
        abortRef.current = null
      }
    },
    [isStreaming, orgId, sessionId, pageContext, isFirstMessage, queryClient]
  )

  const handleSend = (message: string) => {
    setShowHistory(false)
    sendMessage(message)
  }

  return (
    <div className="flex h-full">
      {/* Session history sidebar */}
      {showHistory && (
        <div className="w-64 shrink-0 border-r flex flex-col bg-muted/30">
          <div className="flex items-center justify-between px-3 py-3 border-b">
            <span className="text-sm font-medium">Historia</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            <div className="space-y-0.5">
              {sessions && sessions.length > 0 ? (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                      s.id === sessionId ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <div className="truncate">
                      {s.title ?? "Nova konverzacia"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.updated_at).toLocaleDateString("sk-SK")}
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Ziadne konverzacie
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-base font-semibold">AI Asistent</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs gap-1.5"
            >
              <History className="h-4 w-4" />
              Historia
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={newSession}
              className="text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Novy chat
            </Button>
          </div>
        </div>

        <Separator />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
          <div className="mx-auto max-w-2xl py-4">
            {messages.length === 0 && !isStreaming ? (
              <div className="space-y-4 py-16">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Opytajte sa na cokolvek o vasich financiach
                </p>
                <ChatSuggestionChips onSelect={handleSend} disabled={isStreaming} />
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} role={msg.role} content={msg.content} />
                ))}
                {isStreaming && streamingText && (
                  <ChatMessage role="assistant" content={streamingText} />
                )}
                {isStreaming && !streamingText && <ChatMessageSkeleton />}
              </>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      </div>
    </div>
  )
}
