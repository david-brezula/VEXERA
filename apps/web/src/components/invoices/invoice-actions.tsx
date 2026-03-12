"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Trash2Icon,
  SendIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ReceiptIcon,
} from "lucide-react"

import { updateInvoiceStatusAction, deleteInvoiceAction, createCreditNoteAction } from "@/lib/actions/invoices"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { InvoiceStatus } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusAction = {
  label: string
  newStatus: InvoiceStatus | "delete"
  variant: "default" | "outline" | "destructive"
  icon: React.ComponentType<{ className?: string }>
  confirm?: boolean
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  draft: [
    { label: "Mark as sent", newStatus: "sent", variant: "default", icon: SendIcon },
    {
      label: "Delete",
      newStatus: "delete",
      variant: "destructive",
      icon: Trash2Icon,
      confirm: true,
    },
  ],
  sent: [
    { label: "Mark as paid", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    {
      label: "Mark as overdue",
      newStatus: "overdue",
      variant: "outline",
      icon: ClockIcon,
    },
    { label: "Credit note", newStatus: "credit_note" as any, variant: "outline", icon: ReceiptIcon },
    {
      label: "Cancel",
      newStatus: "delete",
      variant: "destructive",
      icon: XCircleIcon,
      confirm: true,
    },
  ],
  paid: [
    { label: "Credit note", newStatus: "credit_note" as any, variant: "outline", icon: ReceiptIcon },
  ],
  overdue: [
    { label: "Mark as paid", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    {
      label: "Cancel",
      newStatus: "delete",
      variant: "destructive",
      icon: XCircleIcon,
      confirm: true,
    },
  ],
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  invoiceId: string
  invoiceNumber: string
  status: string
}

export function InvoiceActionsBar({ invoiceId, invoiceNumber, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const actions = STATUS_ACTIONS[status] ?? []

  function handleAction(action: StatusAction) {
    startTransition(async () => {
      if (action.newStatus === "delete") {
        const result = await deleteInvoiceAction(invoiceId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Invoice deleted")
          router.push("/invoices")
        }
      } else if ((action.newStatus as string) === "credit_note") {
        const result = await createCreditNoteAction(invoiceId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Credit note created")
          router.push(`/invoices/${result.id}`)
        }
      } else {
        const result = await updateInvoiceStatusAction(invoiceId, action.newStatus)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(`Invoice marked as ${action.newStatus}`)
          router.refresh()
        }
      }
    })
  }

  return (
    <>
      {actions.map((action) =>
        action.confirm ? (
          <Dialog key={action.newStatus}>
            <DialogTrigger asChild>
              <Button variant={action.variant} size="sm" disabled={isPending}>
                <action.icon className="size-4" />
                {action.label}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  This will {action.label.toLowerCase()} invoice {invoiceNumber}. This
                  action cannot be easily undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant={action.variant}
                  onClick={() => handleAction(action)}
                  disabled={isPending}
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
            onClick={() => handleAction(action)}
            disabled={isPending}
          >
            <action.icon className="size-4" />
            {action.label}
          </Button>
        )
      )}
    </>
  )
}
