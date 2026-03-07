"use client"

import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  ChevronLeftIcon,
  PrinterIcon,
  PencilIcon,
  Trash2Icon,
  CheckCircleIcon,
  SendIcon,
  XCircleIcon,
  ClockIcon,
  FileTextIcon,
  HistoryIcon,
  UploadIcon,
} from "lucide-react"

import { useInvoice, useUpdateInvoiceStatus, useDeleteInvoice } from "@/hooks/use-invoices"
import { useDocuments } from "@/hooks/use-documents"
import { useOrganization } from "@/providers/organization-provider"
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { DocumentUploader } from "@/components/documents/document-uploader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatEur } from "@vexera/utils"
import type { InvoiceStatus } from "@vexera/types"
import { getDocumentDownloadUrl } from "@/hooks/use-documents"
import { queryKeys } from "@/lib/query-keys"
import { useQueryClient } from "@tanstack/react-query"

// ─── Status action config ─────────────────────────────────────────────────────

type StatusAction = {
  label: string
  newStatus: InvoiceStatus
  variant: "default" | "outline" | "destructive"
  icon: React.ComponentType<{ className?: string }>
  confirm?: boolean
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  draft: [
    { label: "Mark as sent", newStatus: "sent", variant: "default", icon: SendIcon },
    { label: "Delete", newStatus: "cancelled", variant: "destructive", icon: Trash2Icon, confirm: true },
  ],
  sent: [
    { label: "Mark as paid", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    { label: "Mark as overdue", newStatus: "overdue", variant: "outline", icon: ClockIcon },
    { label: "Cancel", newStatus: "cancelled", variant: "destructive", icon: XCircleIcon, confirm: true },
  ],
  overdue: [
    { label: "Mark as paid", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    { label: "Cancel", newStatus: "cancelled", variant: "destructive", icon: XCircleIcon, confirm: true },
  ],
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeOrg } = useOrganization()
  const { data: invoice, isLoading } = useInvoice(id)
  const { data: documents } = useDocuments({ invoice_id: id })
  const updateStatus = useUpdateInvoiceStatus()
  const deleteInvoice = useDeleteInvoice()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileTextIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Invoice not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/invoices">Back to invoices</Link>
        </Button>
      </div>
    )
  }

  const actions = STATUS_ACTIONS[invoice.status] ?? []
  const isEditable = invoice.status === "draft" || invoice.status === "sent"

  async function handleStatusChange(action: StatusAction) {
    if (action.newStatus === "cancelled") {
      await deleteInvoice.mutateAsync(id)
      router.push("/invoices")
    } else {
      await updateStatus.mutateAsync({ invoiceId: id, status: action.newStatus })
    }
  }

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
          {isEditable && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${id}/edit`}>
                <PencilIcon className="size-4" />
                Edit
              </Link>
            </Button>
          )}
          {actions.map((action) => (
            action.confirm ? (
              <Dialog key={action.newStatus}>
                <DialogTrigger asChild>
                  <Button variant={action.variant} size="sm">
                    <action.icon className="size-4" />
                    {action.label}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                      This will {action.label.toLowerCase()} invoice {invoice.invoice_number}.
                      This action cannot be easily undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant={action.variant}
                      onClick={() => handleStatusChange(action)}
                      disabled={updateStatus.isPending || deleteInvoice.isPending}
                    >
                      {action.label}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button
                key={action.newStatus}
                variant={action.variant}
                size="sm"
                onClick={() => handleStatusChange(action)}
                disabled={updateStatus.isPending}
              >
                <action.icon className="size-4" />
                {action.label}
              </Button>
            )
          ))}
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
            Documents {documents && documents.length > 0 && `(${documents.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Invoice tab ────────────────────────────────────────────── */}
        <TabsContent value="invoice" className="space-y-6 mt-6">
          {/* Supplier / Customer grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Supplier (Dodávateľ)
              </p>
              <p className="font-semibold">{invoice.supplier_name}</p>
              {invoice.supplier_ico && <p className="text-sm text-muted-foreground">IČO: {invoice.supplier_ico}</p>}
              {invoice.supplier_dic && <p className="text-sm text-muted-foreground">DIČ: {invoice.supplier_dic}</p>}
              {invoice.supplier_ic_dph && <p className="text-sm text-muted-foreground">IČ DPH: {invoice.supplier_ic_dph}</p>}
              {invoice.supplier_address && <p className="text-sm text-muted-foreground">{invoice.supplier_address}</p>}
              {invoice.supplier_iban && <p className="text-sm text-muted-foreground font-mono">IBAN: {invoice.supplier_iban}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer (Odberateľ)
              </p>
              <p className="font-semibold">{invoice.customer_name}</p>
              {invoice.customer_ico && <p className="text-sm text-muted-foreground">IČO: {invoice.customer_ico}</p>}
              {invoice.customer_dic && <p className="text-sm text-muted-foreground">DIČ: {invoice.customer_dic}</p>}
              {invoice.customer_ic_dph && <p className="text-sm text-muted-foreground">IČ DPH: {invoice.customer_ic_dph}</p>}
              {invoice.customer_address && <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>}
            </div>
          </div>

          <Separator />

          {/* Dates + payment */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Issue date</p>
              <p className="font-medium">{format(new Date(invoice.issue_date), "dd.MM.yyyy")}</p>
            </div>
            {invoice.delivery_date && (
              <div>
                <p className="text-muted-foreground">Delivery date</p>
                <p className="font-medium">{format(new Date(invoice.delivery_date), "dd.MM.yyyy")}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Due date</p>
              <p className="font-medium">{format(new Date(invoice.due_date), "dd.MM.yyyy")}</p>
            </div>
            {invoice.payment_method && (
              <div>
                <p className="text-muted-foreground">Payment method</p>
                <p className="font-medium capitalize">{invoice.payment_method.replace("_", " ")}</p>
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
                        <Badge variant="outline" className="text-xs">{item.vat_rate}%</Badge>
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

        {/* ── Documents tab ──────────────────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4 mt-6">
          <DocumentUploader invoiceId={id} onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documents.forInvoice(id) })
          }} />
          {documents && documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {doc.document_type?.replace(/_/g, " ")}
                      {doc.file_size_bytes && ` · ${(doc.file_size_bytes / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const url = await getDocumentDownloadUrl(doc.file_path)
                      window.open(url, "_blank")
                    }}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── History tab ────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-6">
          <p className="text-sm text-muted-foreground">
            Audit log for this invoice — Phase 2 feature.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
