"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import type { VatSummary, VatTimelinePoint } from "@/features/reports/vat/data"

interface VatWidgetProps {
  current: VatSummary
  timeline: VatTimelinePoint[]
}

export function VatWidget({ current, timeline }: VatWidgetProps) {
  const isRefund = current.vat_liability < 0
  const liabilityColor = isRefund ? "text-green-600" : "text-red-600"
  const liabilityLabel = isRefund ? "Nárok na vrátenie DPH" : "DPH na úhradu daňovému úradu"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pozícia DPH</h2>
        <p className="text-sm text-muted-foreground">
          {current.period_label} — based on {current.document_count} documents
        </p>
      </div>

      {/* Main VAT cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">DPH na výstupe (odvedená)</CardTitle>
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
            <CardTitle className="text-sm font-medium">DPH na vstupe (odpočítateľná)</CardTitle>
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
              Čistá povinnosť DPH
              <Badge variant={isRefund ? "secondary" : "destructive"} className="ml-2 text-xs">
                {isRefund ? "Vrátenie" : "Na úhradu"}
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
          <CardTitle className="text-sm font-semibold">Rozpis podľa sadzby DPH</CardTitle>
          <CardDescription className="text-xs">
            Slovenské sadzby DPH: 20 % (základná), 10 % (znížená), 5 % (super-znížená)
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sadzba</TableHead>
              <TableHead className="text-right">DPH na výstupe</TableHead>
              <TableHead className="text-right">DPH na vstupe</TableHead>
              <TableHead className="text-right">Čistá</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">23%</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_output_23)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_input_23)}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${
                current.vat_output_23 - current.vat_input_23 > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {formatEur(current.vat_output_23 - current.vat_input_23)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">19%</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_output_19)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(current.vat_input_19)}</TableCell>
              <TableCell className={`text-right font-medium tabular-nums ${
                current.vat_output_19 - current.vat_input_19 > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {formatEur(current.vat_output_19 - current.vat_input_19)}
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
              <TableCell>Spolu</TableCell>
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
            <CardTitle className="text-sm font-semibold">Štvrťročný trend DPH</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Štvrťrok</TableHead>
                <TableHead className="text-right">Výstup</TableHead>
                <TableHead className="text-right">Vstup</TableHead>
                <TableHead className="text-right">Povinnosť</TableHead>
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

      {/* Link to VAT Returns */}
      <div className="flex justify-end">
        <Link
          href="/tax/vat"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Zobraziť priznania DPH
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
