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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { toast } from "sonner"
import { revokeAccountantAccessAction } from "@/features/settings/actions-members"
import type { AccountantDashboardData, ClientSummary } from "@vexera/types"

function StatusBadge({ status }: { status: ClientSummary["status"] }) {
  if (status === "needs_attention") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertCircle className="h-3 w-3" /> Vyžaduje pozornosť
      </Badge>
    )
  }
  if (status === "idle") {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Clock className="h-3 w-3" /> Neaktívny
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
      V poriadku
    </Badge>
  )
}

function formatDaysAgo(days: number): string {
  if (days < 0) return "Nikdy"
  if (days === 0) return "Dnes"
  if (days === 1) return "Včera"
  if (days < 7) return `${days}d dozadu`
  if (days < 30) return `${Math.floor(days / 7)}t dozadu`
  return `${Math.floor(days / 30)}m dozadu`
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
          <CardTitle className="text-sm font-medium">Odkaz pre klientov</CardTitle>
          <CardDescription className="text-xs">
            Zdieľajte tento odkaz s klientmi pre pripojenie k vašej firme
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
            {copied ? "Skopírované" : "Kopírovať"}
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
    if (!window.confirm(`Naozaj chcete zrušiť prístup k ${orgName}?`)) return
    startTransition(async () => {
      const result = await revokeAccountantAccessAction(accountantClientId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Prístup k ${orgName} zrušený`)
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
            <CardTitle className="text-sm font-medium">Aktívni klienti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_clients}</div>
            {needsAttentionCount > 0 && (
              <p className="text-xs text-destructive font-medium mt-1">
                {needsAttentionCount} vyžadujú pozornosť
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nespracované doklady</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_unprocessed}</div>
            <p className="text-xs text-muted-foreground mt-1">Zo všetkých klientov</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Miera automatizácie</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall_auto_rate}%</div>
            <Progress value={data.overall_auto_rate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ušetrené hodiny</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estimated_hours_saved}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.docs_processed_this_week} dokladov tento týždeň
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
              <CardTitle className="text-base">Prehľad klientov</CardTitle>
              <CardDescription className="text-xs">
                Zoradené podľa naliehavosti — klienti vyžadujúci pozornosť sú zobrazení prví
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled className="gap-1.5">
                      <UserPlusIcon className="h-4 w-4" />
                      Pridať klienta
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Čoskoro — požiadajte klienta, aby vás pozval zo stránky Členovia</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        {data.clients.length === 0 ? (
          <CardContent>
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-30" />
              <h3 className="text-sm font-medium">Zatiaľ žiadni klienti</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Pridajte prvú klientsku organizáciu.
              </p>
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="text-center">Nespracované</TableHead>
                <TableHead className="text-center">Auto-miera</TableHead>
                <TableHead className="text-center">Nespárované tx</TableHead>
                <TableHead>Posledná aktivita</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clients.map((client) => (
                <TableRow key={client.organization_id}>
                  <TableCell>
                    <div className="font-medium">{client.organization_name}</div>
                    <span className="text-xs text-muted-foreground">
                      {client.total_docs} dokladov celkom
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
                          <Link href="/inbox">Zobraziť</Link>
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
                          Zrušiť prístup
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
