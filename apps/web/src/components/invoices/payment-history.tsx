"use client"

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface InvoicePayment {
  id: string
  amount: number
  currency: string
  payment_date: string
  payment_method: string
  reference: string | null
  notes: string | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

const methodLabels: Record<string, string> = {
  bank_transfer: "Bankový prevod",
  cash: "Hotovosť",
  card: "Karta",
  other: "Iné",
}

interface PaymentHistoryProps {
  invoiceId: string
  totalAmount?: number
  paidAmount?: number
}

export function PaymentHistory({ invoiceId, totalAmount, paidAmount }: PaymentHistoryProps) {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", invoiceId],
    queryFn: async () => {
      const result = await fetchJson<{ data: InvoicePayment[] }>(
        `/api/payments?invoice_id=${invoiceId}`
      )
      return result.data
    },
    enabled: !!invoiceId,
  })

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  const remaining = totalAmount && paidAmount !== undefined
    ? Number((totalAmount - paidAmount).toFixed(2))
    : null

  return (
    <div className="space-y-3">
      {/* Summary */}
      {totalAmount !== undefined && paidAmount !== undefined && (
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Celkom: </span>
            <span className="font-medium">{totalAmount.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div>
            <span className="text-muted-foreground">Zaplatené: </span>
            <span className="font-medium text-green-600">{paidAmount.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €</span>
          </div>
          {remaining !== null && remaining > 0 && (
            <div>
              <span className="text-muted-foreground">Zostáva: </span>
              <span className="font-medium text-red-500">{remaining.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €</span>
            </div>
          )}
          {remaining !== null && remaining < 0 && (
            <Badge variant="destructive">Preplatok: {Math.abs(remaining).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €</Badge>
          )}
        </div>
      )}

      {/* Payment list */}
      {payments && payments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead>Spôsob</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">Suma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.payment_date).toLocaleDateString("sk-SK")}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {methodLabels[payment.payment_method] ?? payment.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{payment.reference ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {payment.amount.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {payment.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">Zatiaľ žiadne platby</p>
      )}
    </div>
  )
}
