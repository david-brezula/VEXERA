"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { Switch } from "@/shared/components/ui/switch"
import { ICOLookupInput } from "./ico-lookup-input"

interface ContactFormData {
  name: string
  ico: string
  dic: string
  ic_dph: string
  contact_type: "client" | "supplier" | "both"
  street: string
  city: string
  postal_code: string
  country: string
  email: string
  phone: string
  website: string
  bank_account: string
  is_key_client: boolean
  notes: string
}

interface ContactFormProps {
  initialData?: Partial<ContactFormData>
  onSubmit: (data: ContactFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

const defaultData: ContactFormData = {
  name: "",
  ico: "",
  dic: "",
  ic_dph: "",
  contact_type: "client",
  street: "",
  city: "",
  postal_code: "",
  country: "SK",
  email: "",
  phone: "",
  website: "",
  bank_account: "",
  is_key_client: false,
  notes: "",
}

export function ContactForm({ initialData, onSubmit, onCancel, isLoading }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>({ ...defaultData, ...initialData })

  const update = (field: keyof ContactFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleLookupResult = (data: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      name: (data.name as string) || prev.name,
      ico: (data.ico as string) || prev.ico,
      dic: (data.dic as string) || prev.dic,
      ic_dph: (data.ic_dph as string) || prev.ic_dph,
      street: (data.street as string) || prev.street,
      city: (data.city as string) || prev.city,
      postal_code: (data.postal_code as string) || prev.postal_code,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* IČO Lookup */}
      <div className="space-y-2">
        <Label>IČO</Label>
        <ICOLookupInput
          value={form.ico}
          onChange={(v) => update("ico", v)}
          onLookupResult={handleLookupResult}
        />
      </div>

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Názov *</Label>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Typ kontaktu</Label>
          <Select value={form.contact_type} onValueChange={(v) => update("contact_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Klient</SelectItem>
              <SelectItem value="supplier">Dodávateľ</SelectItem>
              <SelectItem value="both">Klient / Dodávateľ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tax IDs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>DIČ</Label>
          <Input value={form.dic} onChange={(e) => update("dic", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>IČ DPH</Label>
          <Input value={form.ic_dph} onChange={(e) => update("ic_dph", e.target.value)} />
        </div>
      </div>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Ulica</Label>
          <Input value={form.street} onChange={(e) => update("street", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Mesto</Label>
          <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>PSČ</Label>
          <Input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Krajina</Label>
          <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
        </div>
      </div>

      {/* Contact details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefón</Label>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Web</Label>
          <Input value={form.website} onChange={(e) => update("website", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>IBAN</Label>
          <Input value={form.bank_account} onChange={(e) => update("bank_account", e.target.value)} />
        </div>
      </div>

      {/* Key client toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_key_client}
          onCheckedChange={(v) => update("is_key_client", v)}
        />
        <Label>Kľúčový klient</Label>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Poznámky</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Zrušiť
        </Button>
        <Button type="submit" disabled={isLoading || !form.name.trim()}>
          {initialData ? "Uložiť zmeny" : "Vytvoriť kontakt"}
        </Button>
      </div>
    </form>
  )
}
