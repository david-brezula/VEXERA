// ─── Service ─────────────────────────────────────────────────────────────────
export {
  buildOrgContext,
  fetchRelevantData,
  getOrCreateSession,
  getSessionMessages,
  listSessions,
  processQuery,
  saveMessage,
} from "./service"

export type {
  ChatMessage,
  ChatSession,
  ProcessQueryResult,
} from "./service"

// ─── Hooks ───────────────────────────────────────────────────────────────────
export {
  useChat,
  useChatMessages,
  useChatSessions,
  useSendMessage,
} from "./hooks"

// ─── Components ──────────────────────────────────────────────────────────────
export { ChatInput } from "./components/chat-input"
export { ChatInterface } from "./components/chat-interface"
export { ChatMessage as ChatMessageComponent, ChatMessageSkeleton } from "./components/chat-message"
export { ChatPanel } from "./components/chat-panel"
export { ChatSuggestionChips } from "./components/chat-suggestion-chips"
