"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  FileText,
  CheckCircle,
  XCircle,
  Landmark,
  GitMerge,
  Zap,
  Upload,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@/hooks/use-notifications"
import type { Notification } from "@/hooks/use-notifications"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function resolveActionUrl(notification: Notification): string | null {
  const { entity_type, entity_id } = notification
  if (!entity_type || !entity_id) return null
  switch (entity_type) {
    case "invoice":
      return `/invoices/${entity_id}`
    case "document":
      return `/documents/${entity_id}`
    case "bank_transaction":
      return `/bank`
    default:
      return null
  }
}

function NotificationIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0"
  switch (type) {
    case "invoice_overdue":
      return <FileText className={cn(cls, "text-red-500")} />
    case "document_ocr_done":
      return <CheckCircle className={cn(cls, "text-green-500")} />
    case "document_ocr_failed":
      return <XCircle className={cn(cls, "text-red-500")} />
    case "bank_import_done":
      return <Landmark className={cn(cls, "text-blue-500")} />
    case "reconciliation_match":
      return <GitMerge className={cn(cls, "text-purple-500")} />
    case "rule_applied":
      return <Zap className={cn(cls, "text-yellow-500")} />
    case "export_ready":
      return <Upload className={cn(cls, "text-emerald-500")} />
    default:
      return <Info className={cn(cls, "text-muted-foreground")} />
  }
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification
  onSelect: (n: Notification) => void
}

function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const isUnread = !notification.is_read

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isUnread && "border-l-2 border-primary bg-primary/5"
      )}
    >
      <div className="mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm leading-tight",
            isUnread ? "font-semibold" : "font-normal text-muted-foreground"
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground/70">
          {relativeTime(notification.created_at)}
        </p>
      </div>

      {isUnread && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  )
}

// ─── LoadingSkeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-1 px-1 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-3">
          <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── NotificationsBell ────────────────────────────────────────────────────────

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const { data, isLoading } = useNotifications({ limit: 20 })
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const notifications = data?.data ?? []
  const unreadCount = data?.unread_count ?? 0
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount)

  // Mark all visible unread notifications as read when popover opens
  useEffect(() => {
    if (!open) return
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length > 0) {
      markAsRead.mutate(unreadIds)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSelect(notification: Notification) {
    setOpen(false)
    const url = resolveActionUrl(notification)
    if (url) {
      router.push(url)
    }
  }

  function handleMarkAllRead() {
    markAllAsRead.mutate()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-1 top-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground",
                "font-semibold leading-none",
                unreadCount > 9
                  ? "h-4 min-w-4 px-1 text-[9px]"
                  : "h-4 w-4 text-[10px]"
              )}
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              disabled={markAllAsRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Body */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-0.5 px-1 py-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
