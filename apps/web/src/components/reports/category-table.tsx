"use client"

import { Fragment, useState, useTransition } from "react"
import { ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { formatEur } from "@vexera/utils"
import type { CategoryBreakdownRow } from "@/lib/services/reports/report.types"
import { getDrilldownDocumentsAction } from "@/lib/actions/report-drilldown"

interface DrilldownDocument {
  id: string
  name: string
  issue_date: string | null
  total_amount: number | null
  status: string
  document_type: string
}

interface CategoryTableProps {
  rows: CategoryBreakdownRow[]
  total: number
  currency?: string
  onCategoryClick?: (category: string, documentIds: string[]) => void
  comparisonRows?: CategoryBreakdownRow[]
}

export function CategoryTable({ rows, total, currency = "EUR", onCategoryClick, comparisonRows }: CategoryTableProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [drilldownDocs, setDrilldownDocs] = useState<DrilldownDocument[]>([])
  const [isPending, startTransition] = useTransition()

  const hasComparison = !!comparisonRows && comparisonRows.length > 0

  function handleRowClick(row: CategoryBreakdownRow) {
    if (onCategoryClick) {
      onCategoryClick(row.category, row.documentIds)
      return
    }

    if (expandedCategory === row.category) {
      setExpandedCategory(null)
      setDrilldownDocs([])
      return
    }

    setExpandedCategory(row.category)
    setDrilldownDocs([])
    startTransition(async () => {
      const docs = await getDrilldownDocumentsAction(row.documentIds)
      setDrilldownDocs(docs)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Žiadne údaje pre zvolené obdobie.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30px]" />
          <TableHead>Kategória</TableHead>
          <TableHead className="text-right">Suma</TableHead>
          {hasComparison && <TableHead className="text-right">Predchádzajúce</TableHead>}
          {hasComparison && <TableHead className="text-right">Zmena</TableHead>}
          <TableHead className="w-[100px] text-right">Počet</TableHead>
          <TableHead className="w-[200px]">Podiel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isExpanded = expandedCategory === row.category
          const compRow = hasComparison
            ? comparisonRows!.find((c) => c.category === row.category)
            : undefined

          return (
            <Fragment key={row.category}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(row)}
              >
                <TableCell className="pr-0">
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.category}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.totalAmount.toLocaleString("sk-SK", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {currency}
                </TableCell>
                {hasComparison && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {compRow
                      ? `${compRow.totalAmount.toLocaleString("sk-SK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${currency}`
                      : "—"}
                  </TableCell>
                )}
                {hasComparison && (
                  <TableCell className="text-right">
                    <ChangeIndicator current={row.totalAmount} previous={compRow?.totalAmount} />
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">{row.transactionCount}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={row.percentage} className="h-2" />
                    <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                      {row.percentage}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>

              {isExpanded && (
                <TableRow key={`${row.category}-drilldown`}>
                  <TableCell colSpan={hasComparison ? 7 : 5} className="p-0">
                    <div className="bg-muted/30 px-8 py-3">
                      {isPending ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ) : drilldownDocs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Žiadne dokumenty.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Názov</TableHead>
                              <TableHead>Dátum</TableHead>
                              <TableHead className="text-right">Suma</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {drilldownDocs.map((doc) => (
                              <TableRow key={doc.id} className="text-sm">
                                <TableCell>{doc.name}</TableCell>
                                <TableCell className="tabular-nums">
                                  {doc.issue_date
                                    ? new Date(doc.issue_date).toLocaleDateString("sk-SK")
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {doc.total_amount != null ? formatEur(doc.total_amount) : "—"}
                                </TableCell>
                                <TableCell>{doc.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          )
        })}
        <TableRow className="font-bold border-t-2">
          <TableCell />
          <TableCell>Celkovo</TableCell>
          <TableCell className="text-right tabular-nums">
            {total.toLocaleString("sk-SK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {currency}
          </TableCell>
          {hasComparison && <TableCell />}
          {hasComparison && <TableCell />}
          <TableCell className="text-right tabular-nums">
            {rows.reduce((s, r) => s + r.transactionCount, 0)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  )
}

function ChangeIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous == null || previous === 0) {
    if (current === 0) return <span className="text-xs text-muted-foreground">—</span>
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
        <ArrowUp className="size-3" /> nové
      </span>
    )
  }

  const delta = ((current - previous) / previous) * 100
  const formatted = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`

  if (Math.abs(delta) < 0.1) {
    return <span className="text-xs text-muted-foreground">0,0%</span>
  }

  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
      <ArrowUp className="size-3" /> {formatted}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
      <ArrowDown className="size-3" /> {formatted}
    </span>
  )
}
