"use client"

import { useMemo, useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Download, FileText } from "lucide-react"
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
import { getIncomeTaxDataAction } from "@/lib/data/income-tax"
import { exportIncomeTaxAction } from "@/lib/actions/xml-export"
import { getUpcomingDeadlinesAction } from "@/lib/actions/legislative"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IncomeTaxPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [isExporting, setIsExporting] = useState(false)

  const yearOptions = useMemo(() => {
    const years: string[] = []
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(String(y))
    }
    return years
  }, [currentYear])

  const { data: result, isLoading } = useQuery({
    queryKey: ["income-tax", selectedYear],
    queryFn: () => getIncomeTaxDataAction(Number(selectedYear)),
  })

  const { data: deadlinesResult } = useQuery({
    queryKey: ["upcoming-deadlines"],
    queryFn: () => getUpcomingDeadlinesAction(90),
  })

  const taxData = result?.data
  const deadlines = deadlinesResult ?? []
  const incomeTaxDeadline = Array.isArray(deadlines)
    ? deadlines.find(
        (d: any) =>
          d.key?.includes("income_tax") ||
          d.description?.toLowerCase().includes("dan z prijmov"),
      )
    : null

  const deadlineDate = taxData?.filingDeadline ?? (incomeTaxDeadline as any)?.date ?? null
  const daysUntilDeadline = deadlineDate
    ? Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const isDeadlineUrgent = daysUntilDeadline !== null && daysUntilDeadline > 0 && daysUntilDeadline < 30

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const res = await exportIncomeTaxAction(Number(selectedYear))
      if ("error" in res && res.error) {
        return
      }
      if ("xml" in res && res.xml) {
        const blob = new Blob([res.xml], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = res.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
    }
  }, [selectedYear])

  // Non-freelancer orgs
  if (!isLoading && taxData && !taxData.isFreelancer) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dan z prijmov</h1>
          <p className="text-muted-foreground mt-1">Ročné daňové priznanie</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">
              Daňové priznanie právnickej osoby (DP Typ A)
            </h2>
            <p className="text-muted-foreground">
              Podpora pre daňové priznanie právnických osôb bude čoskoro dostupná.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dan z prijmov</h1>
          <p className="text-muted-foreground mt-1">
            Daňové priznanie FO typ B &mdash; SZČO
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={handleExport} disabled={isExporting || isLoading || !taxData}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportujem..." : "Export DP Typ B"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : taxData ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Príjmy YTD</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatEur(taxData.income)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Súčet vydaných faktúr za {selectedYear}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Výdavky YTD</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatEur(taxData.expenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Súčet prijatých faktúr za {selectedYear}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daňový režim</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {taxData.taxRegime === "pausalne_vydavky"
                    ? "Paušálne výdavky"
                    : "Skutočné náklady"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {taxData.taxRegime === "pausalne_vydavky"
                    ? `${formatPercent(taxData.config.flatExpenseRate)} z príjmov, max ${formatEur(taxData.config.flatExpenseCap)}`
                    : "Skutočné preukázané výdavky"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tax calculation breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Výpočet dane</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Položka</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Hrubý príjem</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEur(taxData.income)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Odpočet výdavkov
                      {taxData.taxRegime === "pausalne_vydavky" && (
                        <span className="ml-1 text-muted-foreground text-xs">
                          ({formatPercent(taxData.config.flatExpenseRate)} paušál)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-600">
                      -{formatEur(taxData.taxResult.expenseDeduction)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Odpočet poistného (sociálne + zdravotné)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-600">
                      -{formatEur(taxData.taxResult.insuranceDeduction)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Nezdaniteľná časť základu dane
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-600">
                      -{formatEur(taxData.config.nezdanitelnaČiastka)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold">Základ dane</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatEur(taxData.taxResult.taxBase)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <span className="font-medium">Sadzba dane</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPercent(taxData.config.standardTaxRate)} do{" "}
                        {formatEur(taxData.config.incomeThreshold1)},{" "}
                        {formatPercent(taxData.config.higherTaxRate)} do{" "}
                        {formatEur(taxData.config.incomeThreshold2)},{" "}
                        {formatPercent(taxData.config.topTaxRate)} nad)
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className="border-t-2 bg-muted/50">
                    <TableCell className="font-bold text-base">Odhadovaná daň</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-base text-red-600">
                      {formatEur(taxData.taxResult.estimatedTax)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Monthly contributions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Mesačné odvody (odhad)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Sociálne poistenie</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatEur(taxData.taxResult.socialMonthly)}
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Zdravotné poistenie</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatEur(taxData.taxResult.healthMonthly)}
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filing deadline */}
          {deadlineDate && (
            <Card className={isDeadlineUrgent ? "border-destructive" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {isDeadlineUrgent && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  Termín podania
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <strong>Daňové priznanie FO typ B za rok {selectedYear}</strong>
                  {" "}&mdash; {deadlineDate}
                  {daysUntilDeadline !== null && daysUntilDeadline > 0 && (
                    <span
                      className={
                        isDeadlineUrgent
                          ? "ml-2 text-destructive font-semibold"
                          : "ml-2 text-muted-foreground"
                      }
                    >
                      ({daysUntilDeadline} dní)
                    </span>
                  )}
                  {daysUntilDeadline !== null && daysUntilDeadline <= 0 && (
                    <span className="ml-2 text-destructive font-semibold">
                      (termín uplynul)
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {result?.error ?? "Nepodarilo sa načítať daňové údaje."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
