"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { Switch } from "@/shared/components/ui/switch"

interface ProductFormData {
  name: string
  description: string
  sku: string
  unit: string
  unit_price_net: number
  vat_rate: number
  currency: string
  is_active: boolean
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>
  onSubmit: (data: ProductFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

const defaultData: ProductFormData = {
  name: "",
  description: "",
  sku: "",
  unit: "ks",
  unit_price_net: 0,
  vat_rate: 20,
  currency: "EUR",
  is_active: true,
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>({ ...defaultData, ...initialData })

  const update = (field: keyof ProductFormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Názov *</Label>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Popis</Label>
          <Textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>SKU / Kód</Label>
          <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Jednotka</Label>
          <Input value={form.unit} onChange={(e) => update("unit", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Cena bez DPH *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.unit_price_net}
            onChange={(e) => update("unit_price_net", parseFloat(e.target.value) || 0)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Sadzba DPH (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.vat_rate}
            onChange={(e) => update("vat_rate", parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_active}
          onCheckedChange={(v) => update("is_active", v)}
        />
        <Label>Aktívny produkt</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Zrušiť
        </Button>
        <Button type="submit" disabled={isLoading || !form.name.trim()}>
          {initialData ? "Uložiť zmeny" : "Vytvoriť produkt"}
        </Button>
      </div>
    </form>
  )
}
