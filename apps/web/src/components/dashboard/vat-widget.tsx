"use client"

import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VatSummary, VatTimelinePoint } from "@/lib/data/vat"

interface VatWidgetProps {
  current: VatSummary
  timeline: VatTimelinePoint[]
}

export function VatWidget({ current, timeline }: VatWidgetProps) {
  const isRefund = current.vat_liability < 0
  const liabilityColor = isRefund ? "text-green-600" : "text-red-600"
  const liabilityLabel = isRefund ? "VAT refund due" : "VAT owed to tax authority"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">VAT Position</h2>
        <p className="text-sm text-muted-foreground">
          {current.period_label} — based on {current.document_count} documents
        </p>
      </div>

      {/* Main VAT cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Output VAT (collected)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatEur(current.total_output_vat)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Base: {formatEur(current.taxable_base_output)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Input VAT (deductible)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatEur(current.total_input_vat)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Base: {formatEur(current.taxable_base_input)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Net VAT Liability
              <Badge variant={isRefund ? "secondary" : "destructive"} className="ml-2 text-xs">
                {isRefund ? "Refund" : "Payable"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${liabilityColor}`}>
              {formatEur(Math.abs(current.vat_liability))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{liabilityLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* VAT breakdown by rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Breakdown by VAT Rate</CardTitle>
          <CardDescription className="text-xs">
            Slovak VAT rates: 20% (standard), 10% (reduced), 5% (super-reduced)
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Output VAT</TableHead>
              <TableHead className="text-right">Input VAT</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">20%</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_output_20)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_input_20)}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${
                current.vat_output_20 - current.vat_input_20 > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {formatEur(current.vat_output_20 - current.vat_input_20)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">10%</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_output_10)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_input_10)}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${
                current.vat_output_10 - current.vat_input_10 > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {formatEur(current.vat_output_10 - current.vat_input_10)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">5%</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_output_5)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_input_5)}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${
                current.vat_output_5 - current.vat_input_5 > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {formatEur(current.vat_output_5 - current.vat_input_5)}
              </TableCell>
            </TableRow>
            <TableRow className="font-bold border-t-2">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.total_output_vat)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.total_input_vat)}</TableCell>
              <TableCell className={`text-right tabular-nums ${liabilityColor}`}>
                {formatEur(current.vat_liability)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Quarterly trend */}
      {timeline.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quarterly VAT Trend</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Liability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.map((point) => (
                <TableRow key={point.quarter}>
                  <TableCell className="font-medium">{point.quarter}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEur(point.output)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEur(point.input)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${
                    point.liability > 0 ? "text-red-600" : "text-green-600"
                  }`}>
                    {formatEur(point.liability)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
