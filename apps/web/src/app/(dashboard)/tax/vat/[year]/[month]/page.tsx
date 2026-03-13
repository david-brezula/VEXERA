"use client"

import { useCallback, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getVatReturnDetailAction,
  computeVatReturnAction,
  finalizeVatReturnAction,
  revertVatReturnAction,
  markVatReturnSubmittedAction,
  updateVatReturnNotesAction,
} from "@/lib/actions/vat-returns"
import { exportKvDphAction, exportDpDphAction } from "@/lib/actions/xml-export"
import type { VatReturn } from "@vexera/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">Koncept</Badge>
    case "final":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Finalizovane</Badge>
    case "submitted":
      return <Badge className="bg-green-600 text-white hover:bg-green-700">Podane</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VatReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const year = Number(params.year)
  const month = Number(params.month)
  const monthName = MONTH_NAMES[month - 1] ?? ""

  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [showInvoices, setShowInvoices] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const {
    data: result,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["vat-return-detail", year, month],
    queryFn: () => getVatReturnDetailAction(year, month),
    enabled: !isNaN(year) && !isNaN(month),
  })

  const vatReturn = result?.data as VatReturn | undefined
  const invoices = (result?.invoices ?? []) as any[]

  // Initialize notes when data loads
  if (vatReturn && notes === null) {
    setNotes(vatReturn.notes ?? "")
  }

  const status = vatReturn?.status ?? "draft"
  const isDraft = status === "draft"
  const isFinal = status === "final"
  const isSubmitted = status === "submitted"

  const totalOutput = Number(vatReturn?.total_output_vat ?? 0)
  const totalInput = Number(vatReturn?.total_input_vat ?? 0)
  const liability = Number(vatReturn?.vat_liability ?? 0)
  const isRefund = liability < 0

  const runAction = useCallback(
    async (actionName: string, fn: () => Promise<any>) => {
      setActionLoading(actionName)
      try {
        const result = await fn()
        if (result?.error) {
          console.error(result.error)
          return
        }
        setNotes(null) // reset to re-sync
        await refetch()
        queryClient.invalidateQueries({ queryKey: ["vat-returns"] })
      } finally {
        setActionLoading(null)
      }
    },
    [refetch, queryClient]
  )

  const handleSaveNotes = useCallback(async () => {
    if (notes === null) return
    setSavingNotes(true)
    try {
      await updateVatReturnNotesAction(year, month, notes)
    } finally {
      setSavingNotes(false)
    }
  }, [year, month, notes])

  const handleExportXml = useCallback(
    async (exportFn: (y: number, m: number) => Promise<{ xml?: string; filename?: string; error?: string }>) => {
      setActionLoading("export")
      try {
        const result = await exportFn(year, month)
        if (result.error || !result.xml || !result.filename) {
          console.error(result.error ?? "Export failed")
          return
        }
        const blob = new Blob([result.xml], { type: "application/xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } finally {
        setActionLoading(null)
      }
    },
    [year, month]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!vatReturn) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/tax/vat")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Spat na prehlad
        </Button>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Pre toto obdobie neexistuje DPH priznanie. Vrattte sa a spustite vypocet.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/tax/vat")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Spat
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              DPH Priznanie &mdash; {monthName} {year}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(status)}
              <span className="text-sm text-muted-foreground">
                {vatReturn.document_count} dokladov
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vystupna DPH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-red-600">
              {formatEur(totalOutput)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vstupna DPH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-green-600">
              {formatEur(totalInput)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Danovy zavazok
              {isRefund ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Preplatok
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                  Na uhradu
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatEur(liability)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rozpis podla sadzby DPH</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sadzba</TableHead>
                <TableHead className="text-right">Zaklad vystup</TableHead>
                <TableHead className="text-right">DPH vystup</TableHead>
                <TableHead className="text-right">Zaklad vstup</TableHead>
                <TableHead className="text-right">DPH vstup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  rate: "23%",
                  outputBase: "-",
                  outputVat: Number(vatReturn.vat_output_23),
                  inputBase: "-",
                  inputVat: Number(vatReturn.vat_input_23),
                },
                {
                  rate: "19%",
                  outputBase: "-",
                  outputVat: Number(vatReturn.vat_output_19),
                  inputBase: "-",
                  inputVat: Number(vatReturn.vat_input_19),
                },
                {
                  rate: "5%",
                  outputBase: "-",
                  outputVat: Number(vatReturn.vat_output_5),
                  inputBase: "-",
                  inputVat: Number(vatReturn.vat_input_5),
                },
              ].map((row) => (
                <TableRow key={row.rate}>
                  <TableCell className="font-medium">{row.rate}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.outputBase}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEur(row.outputVat)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.inputBase}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEur(row.inputVat)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Spolu</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(Number(vatReturn.taxable_base_output))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(totalOutput)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(Number(vatReturn.taxable_base_input))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(totalInput)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Line items (collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowInvoices(!showInvoices)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Zahrnuty doklady ({invoices.length})
            </span>
            {showInvoices ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>
        {showInvoices && (
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Ziadne doklady pre toto obdobie
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cislo</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Dodavatel / Odberatel</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead className="text-right">DPH</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">
                        {inv.invoice_number ?? "-"}
                      </TableCell>
                      <TableCell>
                        {inv.invoice_type === "issued" ? "Vydana" : "Prijata"}
                      </TableCell>
                      <TableCell>{inv.issue_date ?? "-"}</TableCell>
                      <TableCell>
                        {inv.supplier_name || inv.customer_name || "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inv.total_amount != null ? formatEur(Number(inv.total_amount)) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inv.vat_amount != null ? formatEur(Number(inv.vat_amount)) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Poznamky</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            readOnly={!isDraft}
            placeholder={isDraft ? "Pridajte poznamky k tomuto priznaniu..." : "Ziadne poznamky"}
            className="min-h-[80px]"
          />
          {isDraft && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? "Ukladam..." : "Ulozit poznamky"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction("recalculate", () =>
                      computeVatReturnAction(year, month)
                    )
                  }
                  disabled={actionLoading !== null}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {actionLoading === "recalculate" ? "Pocitam..." : "Prepocitat"}
                </Button>
                <Button
                  onClick={() => setShowFinalizeDialog(true)}
                  disabled={actionLoading !== null}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Finalizovat
                </Button>
              </>
            )}

            {isFinal && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleExportXml(exportKvDphAction)}
                  disabled={actionLoading !== null}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {actionLoading === "export" ? "Exportujem..." : "Export KV DPH"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleExportXml(exportDpDphAction)}
                  disabled={actionLoading !== null}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {actionLoading === "export" ? "Exportujem..." : "Export DP DPH"}
                </Button>

                <Button
                  onClick={() =>
                    runAction("submit", () =>
                      markVatReturnSubmittedAction(year, month)
                    )
                  }
                  disabled={actionLoading !== null}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {actionLoading === "submit" ? "Oznacujem..." : "Oznacit ako podane"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    runAction("revert", () => revertVatReturnAction(year, month))
                  }
                  disabled={actionLoading !== null}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {actionLoading === "revert" ? "Vraciam..." : "Vratit na koncept"}
                </Button>
              </>
            )}

            {isSubmitted && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleExportXml(exportKvDphAction)}
                  disabled={actionLoading !== null}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {actionLoading === "export" ? "Exportujem..." : "Export KV DPH"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleExportXml(exportDpDphAction)}
                  disabled={actionLoading !== null}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {actionLoading === "export" ? "Exportujem..." : "Export DP DPH"}
                </Button>

                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 self-center px-4 py-2">
                  Podane
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Finalize confirmation dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizovat DPH priznanie?</DialogTitle>
            <DialogDescription>
              Po finalizacii nebude mozne menit data v tomto priznaní. Ak zistite chybu,
              budete ho moct vratit na koncept.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between text-sm">
              <span>Obdobie:</span>
              <span className="font-medium">
                {monthName} {year}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span>Danovy zavazok:</span>
              <span className="font-medium">{formatEur(liability)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              Zrusit
            </Button>
            <Button
              onClick={async () => {
                setShowFinalizeDialog(false)
                await runAction("finalize", () =>
                  finalizeVatReturnAction(year, month)
                )
              }}
              disabled={actionLoading !== null}
            >
              <Lock className="h-4 w-4 mr-2" />
              Finalizovat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
