"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { MailIcon } from "lucide-react"

import { sendInvoiceEmailAction } from "../actions"
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
import { Input } from "@/shared/components/ui/input"

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
      toast.error("Zadajte platnú e-mailovú adresu")
      return
    }
    startTransition(async () => {
      const result = await sendInvoiceEmailAction(invoiceId, email)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`E-mail zaradený pre ${email}`)
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
          Odoslať e-mail
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odoslať faktúru e-mailom</DialogTitle>
          <DialogDescription>
            Odoslať faktúru {invoiceNumber} ako PDF prílohu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="recipient-email" className="text-sm font-medium">
            E-mail príjemcu
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
            {isPending ? "Odosielam..." : "Odoslať"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
