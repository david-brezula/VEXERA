"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { MailIcon } from "lucide-react"

import { sendInvoiceEmailAction } from "@/lib/actions/invoices"
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
import { Input } from "@/components/ui/input"

interface Props {
  invoiceId: string
  invoiceNumber: string
}

export function SendEmailDialog({ invoiceId, invoiceNumber }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    startTransition(async () => {
      const result = await sendInvoiceEmailAction(invoiceId, email)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Email queued for ${email}`)
        setOpen(false)
        setEmail("")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MailIcon className="size-4" />
          Send email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send invoice by email</DialogTitle>
          <DialogDescription>
            Send invoice {invoiceNumber} as a PDF attachment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="recipient-email" className="text-sm font-medium">
            Recipient email
          </label>
          <Input
            id="recipient-email"
            type="email"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={isPending || !email}>
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
