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

import { updateInvoiceStatusAction, deleteInvoiceAction, createCreditNoteAction } from "../actions"
import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"
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
    { label: "Označiť ako odoslanú", newStatus: "sent", variant: "default", icon: SendIcon },
    {
      label: "Vymazať",
      newStatus: "delete",
      variant: "destructive",
      icon: Trash2Icon,
      confirm: true,
    },
  ],
  sent: [
    { label: "Označiť ako zaplatenú", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    {
      label: "Označiť ako po splatnosti",
      newStatus: "overdue",
      variant: "outline",
      icon: ClockIcon,
    },
    { label: "Dobropis", newStatus: "credit_note" as InvoiceStatus, variant: "outline", icon: ReceiptIcon },
    {
      label: "Zrušiť",
      newStatus: "delete",
      variant: "destructive",
      icon: XCircleIcon,
      confirm: true,
    },
  ],
  paid: [
    { label: "Dobropis", newStatus: "credit_note" as InvoiceStatus, variant: "outline", icon: ReceiptIcon },
  ],
  overdue: [
    { label: "Označiť ako zaplatenú", newStatus: "paid", variant: "default", icon: CheckCircleIcon },
    {
      label: "Zrušiť",
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
          toast.success("Faktúra vymazaná")
          router.push("/invoices")
        }
      } else if ((action.newStatus as string) === "credit_note") {
        const result = await createCreditNoteAction(invoiceId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Dobropis vytvorený")
          router.push(`/invoices/${result.id}`)
        }
      } else {
        const result = await updateInvoiceStatusAction(invoiceId, action.newStatus)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(`Faktúra označená ako ${action.newStatus}`)
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
                <DialogTitle>Naozaj?</DialogTitle>
                <DialogDescription>
                  Táto akcia vykoná {action.label.toLowerCase()} pre faktúru {invoiceNumber}. Túto
                  akciu nie je možné jednoducho vrátiť.
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
