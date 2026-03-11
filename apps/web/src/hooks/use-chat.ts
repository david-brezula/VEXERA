"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { ChatSession, ChatMessage } from "@/lib/services/ai-chat.service"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useChatSessions() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.chat.sessions(orgId),
    queryFn: async () => {
      const result = await fetchJson<{ data: ChatSession[] }>(
        `/api/chat/sessions?organization_id=${orgId}`
      )
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.messages(sessionId ?? ""),
    queryFn: async () => {
      const result = await fetchJson<{ data: ChatMessage[] }>(
        `/api/chat/sessions/${sessionId}/messages`
      )
      return result.data
    },
    enabled: !!sessionId,
  })
}

export function useSendMessage() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ message, sessionId }: { message: string; sessionId?: string }) => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{
        data: { sessionId: string; response: string; metadata: Record<string, unknown> }
      }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: activeOrg.id,
          message,
          session_id: sessionId,
        }),
      })
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(activeOrg?.id ?? "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(data.sessionId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

interface ChatState {
  sessionId: string | null
  messages: Array<{ role: "user" | "assistant"; content: string }>
  isLoading: boolean
}

export function useChat() {
  const { activeOrg } = useOrganization()
  const [state, setState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    isLoading: false,
  })

  const sendMessageMutation = useSendMessage()
  const queryClient = useQueryClient()

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || state.isLoading) return

      // Optimistic: add user message immediately
      setState((prev) => ({
        ...prev,
        isLoading: true,
        messages: [...prev.messages, { role: "user" as const, content: message }],
      }))

      try {
        const result = await sendMessageMutation.mutateAsync({
          message,
          sessionId: state.sessionId ?? undefined,
        })

        setState((prev) => ({
          ...prev,
          sessionId: result.sessionId,
          isLoading: false,
          messages: [...prev.messages, { role: "assistant" as const, content: result.response }],
        }))
      } catch {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }))
      }
    },
    [state.isLoading, state.sessionId, sendMessageMutation]
  )

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const result = await fetchJson<{ data: ChatMessage[] }>(
          `/api/chat/sessions/${sessionId}/messages`
        )
        setState({
          sessionId,
          messages: result.data.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          isLoading: false,
        })
      } catch {
        toast.error("Nepodarilo sa načítať konverzáciu")
      }
    },
    []
  )

  const newSession = useCallback(() => {
    setState({ sessionId: null, messages: [], isLoading: false })
  }, [])

  return {
    ...state,
    sendMessage,
    loadSession,
    newSession,
    orgId: activeOrg?.id ?? "",
  }
}
