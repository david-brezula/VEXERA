import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ChevronLeftIcon,
  PrinterIcon,
  PencilIcon,
  FileTextIcon,
  UploadIcon,
  HistoryIcon,
  DownloadIcon,
} from "lucide-react"

import { getInvoice } from "@/lib/data/invoices"
import { getDocuments } from "@/lib/data/documents"
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { InvoiceActionsBar } from "@/components/invoices/invoice-actions"
import { InvoiceDocumentsTab } from "@/components/invoices/invoice-documents-tab"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatEur } from "@vexera/utils"
import type { InvoiceStatus } from "@vexera/types"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [invoice, documentsResult] = await Promise.all([
    getInvoice(id),
    getDocuments({ invoice_id: id }),
  ])
  const documents = documentsResult.data

  if (!invoice) notFound()

  const isEditable = invoice.status === "draft" || invoice.status === "sent"

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/invoices">
              <ChevronLeftIcon className="size-4" />
              Invoices
            </Link>
          </Button>
          <span className="font-mono font-semibold text-lg">{invoice.invoice_number}</span>
          <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${id}/print`} target="_blank">
              <PrinterIcon className="size-4" />
              Print
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/invoices/${id}/pdf`} download>
              <DownloadIcon className="size-4" />
              PDF
            </a>
          </Button>
          {isEditable && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${id}/edit`}>
                <PencilIcon className="size-4" />
                Edit
              </Link>
            </Button>
          )}
          <InvoiceActionsBar
            invoiceId={id}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoice">
        <TabsList>
          <TabsTrigger value="invoice">
            <FileTextIcon className="size-4" />
            Invoice
          </TabsTrigger>
          <TabsTrigger value="documents">
            <UploadIcon className="size-4" />
            Documents {documents.length > 0 && `(${documents.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Invoice tab ──────────────────────────────────────────────────── */}
        <TabsContent value="invoice" className="space-y-6 mt-6">
          {/* Supplier / Customer */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Supplier (Dodávateľ)
              </p>
              <p className="font-semibold">{invoice.supplier_name}</p>
              {invoice.supplier_ico && (
                <p className="text-sm text-muted-foreground">IČO: {invoice.supplier_ico}</p>
              )}
              {invoice.supplier_dic && (
                <p className="text-sm text-muted-foreground">DIČ: {invoice.supplier_dic}</p>
              )}
              {invoice.supplier_ic_dph && (
                <p className="text-sm text-muted-foreground">
                  IČ DPH: {invoice.supplier_ic_dph}
                </p>
              )}
              {invoice.supplier_address && (
                <p className="text-sm text-muted-foreground">{invoice.supplier_address}</p>
              )}
              {invoice.supplier_iban && (
                <p className="text-sm text-muted-foreground font-mono">
                  IBAN: {invoice.supplier_iban}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer (Odberateľ)
              </p>
              <p className="font-semibold">{invoice.customer_name}</p>
              {invoice.customer_ico && (
                <p className="text-sm text-muted-foreground">IČO: {invoice.customer_ico}</p>
              )}
              {invoice.customer_dic && (
                <p className="text-sm text-muted-foreground">DIČ: {invoice.customer_dic}</p>
              )}
              {invoice.customer_ic_dph && (
                <p className="text-sm text-muted-foreground">
                  IČ DPH: {invoice.customer_ic_dph}
                </p>
              )}
              {invoice.customer_address && (
                <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates + payment */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Issue date</p>
              <p className="font-medium">
                {format(new Date(invoice.issue_date), "dd.MM.yyyy")}
              </p>
            </div>
            {invoice.delivery_date && (
              <div>
                <p className="text-muted-foreground">Delivery date</p>
                <p className="font-medium">
                  {format(new Date(invoice.delivery_date), "dd.MM.yyyy")}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Due date</p>
              <p className="font-medium">
                {format(new Date(invoice.due_date), "dd.MM.yyyy")}
              </p>
            </div>
            {invoice.payment_method && (
              <div>
                <p className="text-muted-foreground">Payment method</p>
                <p className="font-medium capitalize">
                  {invoice.payment_method.replace("_", " ")}
                </p>
              </div>
            )}
            {invoice.variable_symbol && (
              <div>
                <p className="text-muted-foreground">Variable symbol</p>
                <p className="font-medium font-mono">{invoice.variable_symbol}</p>
              </div>
            )}
            {invoice.bank_iban && (
              <div>
                <p className="text-muted-foreground">IBAN</p>
                <p className="font-medium font-mono">{invoice.bank_iban}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Line items */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items
            </p>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit price</th>
                    <th className="px-3 py-2 text-right font-medium">VAT</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.invoice_items ?? []).map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEur(Number(item.unit_price))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className="text-xs">
                          {item.vat_rate}%
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatEur(Number(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="ml-auto w-56 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatEur(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>VAT</span>
                <span>{formatEur(Number(invoice.vat_amount))}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span>{formatEur(Number(invoice.total))}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Note
                </p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Documents tab ────────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-6">
          <InvoiceDocumentsTab invoiceId={id} initialDocuments={documents} />
        </TabsContent>

        {/* ── History tab ──────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-6">
          <p className="text-sm text-muted-foreground">
            Audit log for this invoice — Phase 2 feature.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
