"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { createAccountantInvitationAction } from "@/lib/actions/members"
import { UserPlusIcon } from "lucide-react"

const PERMISSION_OPTIONS = [
  { key: "view_invoices" as const, label: "View invoices", defaultChecked: true },
  { key: "close_invoices" as const, label: "Close invoices", defaultChecked: true },
  { key: "manage_ledger" as const, label: "Manage ledger", defaultChecked: true },
  { key: "view_documents" as const, label: "View documents", defaultChecked: true },
  { key: "upload_documents" as const, label: "Upload documents", defaultChecked: false },
]

type PermissionKey = (typeof PERMISSION_OPTIONS)[number]["key"]

export function InviteAccountantDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({
    view_invoices: true,
    close_invoices: true,
    manage_ledger: true,
    view_documents: true,
    upload_documents: false,
  })
  const [isPending, startTransition] = useTransition()

  function togglePermission(key: PermissionKey) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      const result = await createAccountantInvitationAction(email.trim(), permissions)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Accountant invitation sent to ${email}`)
        setEmail("")
        setPermissions({
          view_invoices: true,
          close_invoices: true,
          manage_ledger: true,
          view_documents: true,
          upload_documents: false,
        })
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Invite Accountant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an accountant</DialogTitle>
          <DialogDescription>
            Give an accountant access to your organization. They will be able to
            view and manage your financial data based on the permissions you set.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountant-email">Email address</Label>
            <Input
              id="accountant-email"
              type="email"
              placeholder="accountant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <Label>Permissions</Label>
            {PERMISSION_OPTIONS.map((option) => (
              <div key={option.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`perm-${option.key}`}
                  checked={permissions[option.key]}
                  onCheckedChange={() => togglePermission(option.key)}
                />
                <Label
                  htmlFor={`perm-${option.key}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Sending..." : "Send invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
