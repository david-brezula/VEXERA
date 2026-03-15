"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import {
  Users,
  FileText,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Link2,
  Copy,
  Check,
  MoreHorizontalIcon,
  UserPlusIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { revokeAccountantAccessAction } from "@/lib/actions/members"
import type { AccountantDashboardData, ClientSummary } from "@vexera/types"

function StatusBadge({ status }: { status: ClientSummary["status"] }) {
  if (status === "needs_attention") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertCircle className="h-3 w-3" /> Needs attention
      </Badge>
    )
  }
  if (status === "idle") {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Clock className="h-3 w-3" /> Idle
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
      On track
    </Badge>
  )
}

function formatDaysAgo(days: number): string {
  if (days < 0) return "Never"
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ReferralCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${code}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Referral Link</CardTitle>
          <CardDescription className="text-xs">
            Share this link with clients to connect them to your firm
          </CardDescription>
        </div>
        <Link2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono truncate">
            {referralUrl}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AccountantDashboard({ data }: { data: AccountantDashboardData }) {
  const needsAttentionCount = data.clients.filter(c => c.status === "needs_attention").length
  const [isPending, startTransition] = useTransition()

  function handleRevokeClient(accountantClientId: string, orgName: string) {
    if (!window.confirm(`Are you sure you want to revoke access to ${orgName}?`)) return
    startTransition(async () => {
      const result = await revokeAccountantAccessAction(accountantClientId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Access to ${orgName} revoked`)
        // Page will revalidate via server action
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_clients}</div>
            {needsAttentionCount > 0 && (
              <p className="text-xs text-destructive font-medium mt-1">
                {needsAttentionCount} need attention
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unprocessed Docs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_unprocessed}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-process Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall_auto_rate}%</div>
            <Progress value={data.overall_auto_rate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Saved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estimated_hours_saved}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.docs_processed_this_week} docs this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral link */}
      {data.referral_code && <ReferralCard code={data.referral_code} />}

      {/* Client list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Client Overview</CardTitle>
              <CardDescription className="text-xs">
                Sorted by urgency — clients needing attention appear first
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled className="gap-1.5">
                      <UserPlusIcon className="h-4 w-4" />
                      Add Client
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon — ask your client to invite you from their Members page</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        {data.clients.length === 0 ? (
          <CardContent>
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-30" />
              <h3 className="text-sm font-medium">No clients yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first client organization to get started.
              </p>
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Unprocessed</TableHead>
                <TableHead className="text-center">Auto-rate</TableHead>
                <TableHead className="text-center">Unmatched Tx</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clients.map((client) => (
                <TableRow key={client.organization_id}>
                  <TableCell>
                    <div className="font-medium">{client.organization_name}</div>
                    <span className="text-xs text-muted-foreground">
                      {client.total_docs} total docs
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {client.unprocessed_docs > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {client.unprocessed_docs}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium tabular-nums">
                        {client.auto_process_rate}%
                      </span>
                      <Progress
                        value={client.auto_process_rate}
                        className="h-1.5 w-12"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {client.unmatched_transactions > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {client.unmatched_transactions}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDaysAgo(client.days_since_activity)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={isPending}
                        >
                          <MoreHorizontalIcon className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href="/inbox">View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleRevokeClient(
                              client.accountant_client_id,
                              client.organization_name
                            )
                          }
                        >
                          Revoke Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
