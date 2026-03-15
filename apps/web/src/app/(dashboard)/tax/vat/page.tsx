"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Calculator, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getVatReturnsAction,
  computeVatReturnAction,
  getOrgFilingFrequencyAction,
} from "@/lib/actions/vat-returns"
import { getUpcomingDeadlinesAction } from "@/lib/actions/legislative"
import type { VatReturn } from "@vexera/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

const QUARTER_LABELS = ["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dec)"]

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuarterRow {
  label: string
  quarter: number
  months: number[]
  returns: VatReturn[]
  totalOutput: number
  totalInput: number
  totalLiability: number
  status: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VatReturnsPage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [computingMonth, setComputingMonth] = useState<number | null>(null)

  const { data: frequencyResult } = useQuery({
    queryKey: ["org-filing-frequency"],
    queryFn: () => getOrgFilingFrequencyAction(),
  })
  const filingFrequency = frequencyResult?.data ?? "monthly"

  const {
    data: returnsResult,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["vat-returns", selectedYear],
    queryFn: () => getVatReturnsAction(Number(selectedYear)),
  })
  const returns = (returnsResult?.data ?? []) as VatReturn[]

  const { data: deadlinesResult } = useQuery({
    queryKey: ["upcoming-deadlines"],
    queryFn: () => getUpcomingDeadlinesAction(90),
  })
  const deadlines = deadlinesResult ?? []
  const vatDeadline = Array.isArray(deadlines)
    ? deadlines.find(
        (d: any) => d.key?.includes("vat") || d.description?.toLowerCase().includes("dph")
      )
    : null

  const daysUntilDeadline = vatDeadline ? (vatDeadline as any).daysUntil : null
  const isDeadlineUrgent = daysUntilDeadline !== null && daysUntilDeadline < 14

  // Build a map of month -> return
  const returnsByMonth = useMemo(() => {
    const map = new Map<number, VatReturn>()
    for (const r of returns) {
      map.set(r.period_month, r)
    }
    return map
  }, [returns])

  // Quarter grouping
  const quarterRows = useMemo<QuarterRow[]>(() => {
    return [0, 1, 2, 3].map((qi) => {
      const months = [qi * 3 + 1, qi * 3 + 2, qi * 3 + 3]
      const qReturns = months
        .map((m) => returnsByMonth.get(m))
        .filter((r): r is VatReturn => r !== undefined)
      const combinedStatus =
        qReturns.length === 0
          ? "none"
          : qReturns.every((r) => r.status === "submitted")
            ? "submitted"
            : qReturns.every((r) => r.status === "final" || r.status === "submitted")
              ? "final"
              : "draft"
      return {
        label: QUARTER_LABELS[qi]!,
        quarter: qi + 1,
        months,
        returns: qReturns,
        totalOutput: qReturns.reduce((s, r) => s + Number(r.total_output_vat), 0),
        totalInput: qReturns.reduce((s, r) => s + Number(r.total_input_vat), 0),
        totalLiability: qReturns.reduce((s, r) => s + Number(r.vat_liability), 0),
        status: combinedStatus,
      }
    })
  }, [returnsByMonth])

  const handleCompute = useCallback(
    async (month: number) => {
      setComputingMonth(month)
      try {
        await computeVatReturnAction(Number(selectedYear), month)
        await refetch()
      } finally {
        setComputingMonth(null)
      }
    },
    [selectedYear, refetch]
  )

  const yearOptions = useMemo(() => {
    const years: string[] = []
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(String(y))
    }
    return years
  }, [currentYear])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Priznaie k DPH</h1>
          <p className="text-muted-foreground mt-1">
            Mesacne VAT priznaie a finalizacia
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deadline warning card */}
      {vatDeadline && (
        <Card className={isDeadlineUrgent ? "border-destructive" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {isDeadlineUrgent && <AlertTriangle className="h-4 w-4 text-destructive" />}
              Nasledujuci termin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <strong>{(vatDeadline as any).description}</strong> &mdash;{" "}
              {(vatDeadline as any).date}
              {daysUntilDeadline !== null && (
                <span
                  className={
                    isDeadlineUrgent
                      ? "ml-2 text-destructive font-semibold"
                      : "ml-2 text-muted-foreground"
                  }
                >
                  ({daysUntilDeadline} dni)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Returns table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filingFrequency === "quarterly" ? (
            /* ─── Quarterly view ─── */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obdobie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Vystupna DPH</TableHead>
                  <TableHead className="text-right">Vstupna DPH</TableHead>
                  <TableHead className="text-right">Danovy zavazok</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarterRows.map((qr) => (
                  <TableRow
                    key={qr.quarter}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      // Navigate to first month of quarter
                      router.push(`/tax/vat/${selectedYear}/${qr.months[0]}`)
                    }}
                  >
                    <TableCell className="font-medium">{qr.label}</TableCell>
                    <TableCell>
                      {qr.status === "none" ? (
                        <Badge variant="outline">Nepocitane</Badge>
                      ) : (
                        statusBadge(qr.status)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qr.returns.length > 0 ? formatEur(qr.totalOutput) : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qr.returns.length > 0 ? formatEur(qr.totalInput) : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qr.returns.length > 0 ? formatEur(qr.totalLiability) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {qr.returns.length === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async (e) => {
                            e.stopPropagation()
                            for (const m of qr.months) {
                              await handleCompute(m)
                            }
                          }}
                          disabled={computingMonth !== null}
                        >
                          <Calculator className="h-3 w-3 mr-1" />
                          Vypocitat
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 inline-block ml-2 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            /* ─── Monthly view ─── */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obdobie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Vystupna DPH</TableHead>
                  <TableHead className="text-right">Vstupna DPH</TableHead>
                  <TableHead className="text-right">Danovy zavazok</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 12 }).map((_, i) => {
                  const month = i + 1
                  const ret = returnsByMonth.get(month)
                  return (
                    <TableRow
                      key={month}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (ret) router.push(`/tax/vat/${selectedYear}/${month}`)
                      }}
                    >
                      <TableCell className="font-medium">
                        {MONTH_NAMES[i]} {selectedYear}
                      </TableCell>
                      <TableCell>
                        {ret ? (
                          statusBadge(ret.status)
                        ) : (
                          <Badge variant="outline">Nepocitane</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ret ? formatEur(Number(ret.total_output_vat)) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ret ? formatEur(Number(ret.total_input_vat)) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ret ? formatEur(Number(ret.vat_liability)) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!ret ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCompute(month)
                            }}
                            disabled={computingMonth !== null}
                          >
                            {computingMonth === month ? (
                              "Pocitam..."
                            ) : (
                              <>
                                <Calculator className="h-3 w-3 mr-1" />
                                Vypocitat
                              </>
                            )}
                          </Button>
                        ) : (
                          <ChevronRight className="h-4 w-4 inline-block text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
