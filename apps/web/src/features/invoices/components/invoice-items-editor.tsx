"use client"

import { useFieldArray, useWatch, type Control } from "react-hook-form"
import { PlusIcon, Trash2Icon, InfoIcon } from "lucide-react"
import { ProductPicker } from "./product-picker"
import type { Product } from "@/features/products/service"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shared/components/ui/form"
import { calculateVatAmount, calculateGrossAmount, formatEur, SLOVAK_VAT_RATES } from "@vexera/utils"
import { getAvailableVatRates, getDefaultVatRate, DEFAULT_VAT_RATE } from "../schemas"
import type { InvoiceFormValues } from "../schemas"

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<InvoiceFormValues, any, any>
  /** Whether the organization is registered as DPH (VAT) payer */
  isDphRegistered?: boolean
}

export function InvoiceItemsEditor({ control, isDphRegistered = true }: Props) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  })

  // Watch all items reactively for live totals
  const items = useWatch({ control, name: "items" }) ?? []

  const availableVatRates = getAvailableVatRates(isDphRegistered)
  const defaultVatRate = getDefaultVatRate(isDphRegistered)

  function addItem() {
    append({
      description: "",
      quantity: 1,
      unit: "ks",
      unit_price_net: 0,
      vat_rate: defaultVatRate,
      sort_order: fields.length,
    })
  }

  // ── Per-item computed values ──────────────────────────────────────────────

  function itemNet(i: number) {
    const item = items[i]
    if (!item) return 0
    return (item.quantity ?? 0) * (item.unit_price_net ?? 0)
  }

  function itemVat(i: number) {
    const item = items[i]
    if (!item) return 0
    return calculateVatAmount(itemNet(i), item.vat_rate ?? DEFAULT_VAT_RATE)
  }

  function itemGross(i: number) {
    return calculateGrossAmount(itemNet(i), items[i]?.vat_rate ?? DEFAULT_VAT_RATE)
  }

  // ── Summary totals ────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, _, i) => s + itemNet(i), 0)
  const vatTotal = items.reduce((s, _, i) => s + itemVat(i), 0)
  const grandTotal = subtotal + vatTotal

  // VAT breakdown by rate
  const vatBreakdown = SLOVAK_VAT_RATES.map((rate) => {
    const rateItems = items.filter((item) => (item?.vat_rate ?? 20) === rate)
    const net = rateItems.reduce((s, item) => s + (item?.quantity ?? 0) * (item?.unit_price_net ?? 0), 0)
    const vat = rateItems.reduce((s, item) => s + calculateVatAmount((item?.quantity ?? 0) * (item?.unit_price_net ?? 0), rate), 0)
    return { rate, net, vat, hasItems: rateItems.length > 0 }
  }).filter((b) => b.hasItems)

  return (
    <div className="space-y-4">
      {/* Non-DPH info banner */}
      {!isDphRegistered && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
          <InfoIcon className="size-4 mt-0.5 shrink-0" />
          <span>Nie ste platca DPH. Všetky položky sú bez DPH (0%).</span>
        </div>
      )}

      {/* Header row */}
      <div className="grid grid-cols-[1fr_80px_80px_100px_80px_80px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Unit price (€)</span>
        <span>VAT</span>
        <span className="text-right">Total (€)</span>
        <span />
      </div>

      {/* Item rows */}
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-1">
          <ProductPicker
            onSelect={(product: Product) => {
              update(index, {
                ...fields[index],
                description: product.name,
                unit: product.unit,
                unit_price_net: product.unit_price_net,
                vat_rate: product.vat_rate as 23 | 19 | 5 | 0,
                product_id: product.id,
                sort_order: index,
              })
            }}
          />
          <div className="grid grid-cols-[1fr_80px_80px_100px_80px_80px_36px] gap-2 items-start">
          {/* Description */}
          <FormField
            control={control}
            name={`items.${index}.description`}
            render={({ field: f }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Item description" {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Quantity */}
          <FormField
            control={control}
            name={`items.${index}.quantity`}
            render={({ field: f }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...f}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Unit */}
          <FormField
            control={control}
            name={`items.${index}.unit`}
            render={({ field: f }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="ks" {...f} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Unit price net */}
          <FormField
            control={control}
            name={`items.${index}.unit_price_net`}
            render={({ field: f }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...f}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* VAT rate */}
          <FormField
            control={control}
            name={`items.${index}.vat_rate`}
            render={({ field: f }) => (
              <FormItem>
                <Select
                  onValueChange={(v) => f.onChange(parseInt(v, 10))}
                  value={String(f.value)}
                  disabled={!isDphRegistered}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableVatRates.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Line total (computed, read-only) */}
          <div className="flex items-center justify-end h-9 text-sm tabular-nums">
            {formatEur(itemGross(index))}
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
            disabled={fields.length === 1}
          >
            <Trash2Icon className="size-4" />
          </Button>
          </div>
        </div>
      ))}

      {/* Add item button */}
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
        <PlusIcon className="size-4" />
        Add line item
      </Button>

      {/* Totals summary */}
      <div className="mt-4 ml-auto w-64 space-y-1 rounded-lg border bg-card backdrop-blur-xl p-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal (net)</span>
          <span className="tabular-nums">{formatEur(subtotal)}</span>
        </div>

        {vatBreakdown.map(({ rate, vat }) => (
          <div key={rate} className="flex justify-between text-muted-foreground">
            <span>VAT {rate}%</span>
            <span className="tabular-nums">{formatEur(vat)}</span>
          </div>
        ))}

        <div className="border-t pt-1 flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatEur(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
