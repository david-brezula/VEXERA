"use client"

import { AlertCircle, AlertTriangle, Info, CheckCircle2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useResolveIssue } from "@/hooks/use-health-checks"
import type { HealthCheckIssue } from "@/hooks/use-health-checks"

interface IssueListProps {
  issues: HealthCheckIssue[]
}

const severityConfig = {
  critical: { icon: AlertCircle, label: "Kritické", variant: "destructive" as const, color: "text-red-500" },
  warning: { icon: AlertTriangle, label: "Varovanie", variant: "outline" as const, color: "text-yellow-500" },
  info: { icon: Info, label: "Info", variant: "secondary" as const, color: "text-blue-500" },
}

const checkTypeLabels: Record<string, string> = {
  missing_vat: "Chýba DPH",
  duplicate_suspect: "Možný duplikát",
  unusual_amount: "Nezvyčajná suma",
  missing_field: "Chýbajúce údaje",
  date_inconsistency: "Nesúlad dátumov",
  unmatched_payment: "Nespárovaná platba",
  missing_category: "Chýba kategória",
  supplier_mismatch: "Nesúlad dodávateľa",
}

export function IssueList({ issues }: IssueListProps) {
  const resolveIssue = useResolveIssue()

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="size-12 mb-4 text-green-500" />
        <p className="text-lg font-medium">Žiadne problémy</p>
        <p className="text-sm">Všetky doklady sú v poriadku.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Závažnosť</TableHead>
          <TableHead className="w-[160px]">Typ kontroly</TableHead>
          <TableHead>Popis</TableHead>
          <TableHead className="w-[100px]">Doklad</TableHead>
          <TableHead className="w-[120px] text-right">Akcia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          const config = severityConfig[issue.severity]
          const Icon = config.icon

          return (
            <TableRow key={issue.id} className={issue.resolved ? "opacity-50" : ""}>
              <TableCell>
                <Badge variant={config.variant} className="gap-1">
                  <Icon className="size-3" />
                  {config.label}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {checkTypeLabels[issue.check_type] ?? issue.check_type}
              </TableCell>
              <TableCell className="text-sm max-w-md truncate">
                {issue.message}
              </TableCell>
              <TableCell>
                {issue.document_id && (
                  <a
                    href={`/documents/${issue.document_id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Otvoriť
                  </a>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!issue.resolved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resolveIssue.isPending}
                    onClick={() => resolveIssue.mutate(issue.id)}
                  >
                    <CheckCircle2 className="size-4 mr-1" />
                    OK
                  </Button>
                )}
                {issue.resolved && (
                  <span className="text-xs text-muted-foreground">Vyriešené</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
