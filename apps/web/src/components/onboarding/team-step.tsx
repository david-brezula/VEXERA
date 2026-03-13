"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createInvitationAction } from "@/lib/actions/members"
import { PlusIcon, TrashIcon, UserPlusIcon } from "lucide-react"

interface TeamMember {
  email: string
  role: "admin" | "member"
}

interface TeamStepProps {
  onNext: () => void
  onBack: () => void
}

export function TeamStep({ onNext, onBack }: TeamStepProps) {
  const [members, setMembers] = useState<TeamMember[]>([
    { email: "", role: "member" },
  ])
  const [isPending, startTransition] = useTransition()

  function addRow() {
    setMembers([...members, { email: "", role: "member" }])
  }

  function removeRow(index: number) {
    setMembers(members.filter((_, i) => i !== index))
  }

  function updateEmail(index: number, email: string) {
    const updated = [...members]
    updated[index].email = email
    setMembers(updated)
  }

  function updateRole(index: number, role: "admin" | "member") {
    const updated = [...members]
    updated[index].role = role
    setMembers(updated)
  }

  function handleSkip() {
    onNext()
  }

  function handleSubmit() {
    const validMembers = members.filter((m) => m.email.trim())
    if (validMembers.length === 0) {
      onNext()
      return
    }

    startTransition(async () => {
      let sent = 0
      let failed = 0
      for (const member of validMembers) {
        const result = await createInvitationAction(
          member.email.trim(),
          member.role
        )
        if (result.error) {
          toast.error(`Nepodarilo sa pozvat ${member.email}: ${result.error}`)
          failed++
        } else {
          sent++
        }
      }
      if (sent > 0) {
        toast.success(
          `${sent} pozvank${sent === 1 ? "a odoslana" : sent < 5 ? "y odoslane" : " odoslanych"}`
        )
      }
      onNext()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Pozvite clenov timu na spolupracu. Tento krok mozete preskocit a
          pozvat ich neskor v Nastaveniach.
        </p>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              {index === 0 && <Label>Email</Label>}
              <Input
                type="email"
                placeholder="kolega@firma.sk"
                value={member.email}
                onChange={(e) => updateEmail(index, e.target.value)}
              />
            </div>
            <div className="w-32 space-y-1">
              {index === 0 && <Label>Rola</Label>}
              <Select
                value={member.role}
                onValueChange={(v) =>
                  updateRole(index, v as "admin" | "member")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Clen</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {members.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addRow}>
        <PlusIcon className="h-4 w-4 mr-2" />
        Pridat dalsieho
      </Button>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Preskocit
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          <UserPlusIcon className="h-4 w-4 mr-2" />
          {isPending ? "Odosielam..." : "Odoslat pozvanky a pokracovat"}
        </Button>
      </div>
    </div>
  )
}
