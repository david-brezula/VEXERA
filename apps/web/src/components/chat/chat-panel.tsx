"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatMessage, ChatMessageSkeleton } from "./chat-message"
import { ChatInput } from "./chat-input"
import { ChatSuggestionChips } from "./chat-suggestion-chips"
import { useChat, useChatSessions } from "@/hooks/use-chat"

export function ChatPanel() {
  const [open, setOpen] = useState(false)
  const { messages, isLoading, sendMessage, loadSession, newSession, sessionId } = useChat()
  const { data: sessions } = useChatSessions()
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = (message: string) => {
    setShowHistory(false)
    sendMessage(message)
  }

  const handleSelectSession = (id: string) => {
    loadSession(id)
    setShowHistory(false)
  }

  const handleNewSession = () => {
    newSession()
    setShowHistory(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="sr-only">AI Asistent</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">AI Finančný asistent</SheetTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs"
              >
                História
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNewSession} className="h-8 w-8">
                <Plus className="h-4 w-4" />
                <span className="sr-only">Nová konverzácia</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {showHistory ? (
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-1">
              {sessions && sessions.length > 0 ? (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                      s.id === sessionId ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <div className="truncate">{s.title ?? "Nová konverzácia"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.updated_at).toLocaleDateString("sk-SK")}
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Zatiaľ žiadne konverzácie
                </p>
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4" ref={scrollRef}>
              <div className="py-4">
                {messages.length === 0 && !isLoading ? (
                  <div className="space-y-4 py-8">
                    <p className="text-center text-sm text-muted-foreground">
                      Opýtajte sa na čokoľvek o vašich financiách
                    </p>
                    <ChatSuggestionChips onSelect={handleSend} disabled={isLoading} />
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <ChatMessage key={i} role={msg.role} content={msg.content} />
                    ))}
                    {isLoading && <ChatMessageSkeleton />}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-4 py-3">
              <ChatInput onSend={handleSend} disabled={isLoading} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
