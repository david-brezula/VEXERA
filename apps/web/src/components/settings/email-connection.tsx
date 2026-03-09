"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Mail, Loader2 } from "lucide-react"
import { format as fmtDate } from "date-fns"

import { useOrganization } from "@/providers/organization-provider"
import { useSupabase } from "@/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailConnectionData {
  id: string
  organization_id: string
  email_address: string
  is_active: boolean
  created_at: string
}

// ─── Email Connection Card ────────────────────────────────────────────────────

export function EmailConnection() {
  const { activeOrg } = useOrganization()
  const { supabase } = useSupabase()

  const [connection, setConnection] = useState<EmailConnectionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (!activeOrg) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from("email_connections" as any) as any)
      .select("id, organization_id, email_address, is_active, created_at")
      .eq("organization_id", activeOrg.id)
      .maybeSingle()
      .then(({ data }: { data: EmailConnectionData | null }) => {
        setConnection(data)
      })
      .catch(() => {
        setConnection(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [activeOrg, supabase])

  async function handleConnect() {
    if (!activeOrg) return
    setIsConnecting(true)
    try {
      // The connect endpoint redirects directly to Google OAuth — navigate there
      window.location.href = `/api/email/connect?organization_id=${encodeURIComponent(activeOrg.id)}`
    } catch {
      setIsConnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Integration
        </CardTitle>
        <CardDescription>
          Auto-import invoice attachments from your Gmail inbox
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        ) : connection && connection.is_active ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium">
                  Connected as{" "}
                  <span className="text-foreground">{connection.email_address}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Connected{" "}
                  {fmtDate(new Date(connection.created_at), "d MMM yyyy")}
                </p>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" size="sm" disabled>
                      Disconnect
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              No Gmail account connected. Connect to automatically import invoice
              attachments.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !activeOrg}
              className="shrink-0"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Connect Gmail
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
