"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { toast } from "sonner"
import { createInvitationAction } from "@/features/settings/actions-members"
import { PlusIcon } from "lucide-react"

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      const result = await createInvitationAction(email.trim(), role)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Pozvánka odoslaná na ${email}`)
        setEmail("")
        setRole("member")
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="h-4 w-4 mr-2" />
          Pozvať člena
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pozvať člena tímu</DialogTitle>
          <DialogDescription>
            Odošlite pozvánku e-mailom pre pridanie osoby do organizácie.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailová adresa</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rola</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "admin" | "member")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Člen</SelectItem>
                <SelectItem value="admin">Administrátor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Odosielam..." : "Odoslať pozvánku"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
