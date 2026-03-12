"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import type { CategoryBreakdownRow } from "@/lib/services/reports/report.types"

interface CategoryTableProps {
  rows: CategoryBreakdownRow[]
  total: number
  currency?: string
  onCategoryClick?: (category: string, documentIds: string[]) => void
}

export function CategoryTable({ rows, total, currency = "EUR", onCategoryClick }: CategoryTableProps) {
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
          <TableHead>Kategória</TableHead>
          <TableHead className="text-right">Suma</TableHead>
          <TableHead className="w-[100px] text-right">Počet</TableHead>
          <TableHead className="w-[200px]">Podiel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.category}
            className={onCategoryClick ? "cursor-pointer hover:bg-muted/50" : ""}
            onClick={() => onCategoryClick?.(row.category, row.documentIds)}
          >
            <TableCell className="font-medium">{row.category}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.totalAmount.toLocaleString("sk-SK", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {currency}
            </TableCell>
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
        ))}
        <TableRow className="font-bold border-t-2">
          <TableCell>Celkovo</TableCell>
          <TableCell className="text-right tabular-nums">
            {total.toLocaleString("sk-SK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {currency}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {rows.reduce((s, r) => s + r.transactionCount, 0)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  )
}
