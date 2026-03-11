"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RemainingWorkClient } from "@/lib/services/reports/report.types"

interface RemainingWorkTableProps {
  clients: RemainingWorkClient[]
}

export function RemainingWorkTable({ clients }: RemainingWorkTableProps) {
  if (clients.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Žiadni klienti na zobrazenie
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Klient</TableHead>
          <TableHead className="text-right">Nespracované dok.</TableHead>
          <TableHead className="text-right">Nespárované tx</TableHead>
          <TableHead className="text-right">Neschválené fakt.</TableHead>
          <TableHead className="text-right">Problémy</TableHead>
          <TableHead className="w-[180px]">Pripravenosť</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.organizationId}>
            <TableCell className="font-medium">{client.organizationName}</TableCell>
            <TableCell className="text-right">
              <CountBadge count={client.unprocessedDocuments} />
            </TableCell>
            <TableCell className="text-right">
              <CountBadge count={client.unmatchedTransactions} />
            </TableCell>
            <TableCell className="text-right">
              <CountBadge count={client.unapprovedInvoices} />
            </TableCell>
            <TableCell className="text-right">
              <CountBadge count={client.healthCheckIssues} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={client.readinessPercent} className="h-2 flex-1" />
                <span className="text-sm font-medium w-10 text-right">
                  {client.readinessPercent}%
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-muted-foreground">0</span>
  return (
    <Badge variant={count > 5 ? "destructive" : "secondary"}>
      {count}
    </Badge>
  )
}
