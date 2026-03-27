"use client"

import { useEffect, useRef, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  invoiceSchema,
  orgToInvoiceDefaults,
  type InvoiceFormValues,
} from "../schemas"
import { createInvoiceAction, updateInvoiceAction, getNextInvoiceNumberAction } from "../actions"
import { useOrganization } from "@/providers/organization-provider"
import { InvoiceItemsEditor } from "./invoice-items-editor"
import { ContactPicker } from "./contact-picker"
import type { Contact } from "@/features/contacts/service"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Textarea } from "@/shared/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Separator } from "@/shared/components/ui/separator"

type Props = {
  /** Pass existing invoice data to pre-fill the form for editing */
  defaultValues?: Partial<InvoiceFormValues>
  /** If editing, pass the invoice ID */
  invoiceId?: string
}

export function InvoiceForm({ defaultValues, invoiceId }: Props) {
  const router = useRouter()
  const isEditing = !!invoiceId
  const { activeOrg } = useOrganization()

  const form = useForm<InvoiceFormValues>({
    // Cast resolver to avoid @hookform/resolvers v5 + Zod v4 generic type mismatch
    resolver: zodResolver(invoiceSchema) as unknown as Resolver<InvoiceFormValues>,
    defaultValues: defaultValues ?? orgToInvoiceDefaults(activeOrg, "issued"),
  })

  const [isPending, startTransition] = useTransition()

  // Track whether user has manually edited the invoice number
  const userEditedNumber = useRef(false)

  // Pre-fill invoice number on mount and when invoice_type changes
  const invoiceType = form.watch("invoice_type")
  useEffect(() => {
    if (isEditing) return
    if (userEditedNumber.current) return

    getNextInvoiceNumberAction(invoiceType).then(({ number }) => {
      if (number && !userEditedNumber.current) {
        form.setValue("invoice_number", number)
      }
    }).catch(() => {
      toast.error("Nepodarilo sa načítať číslo faktúry")
    })
  }, [invoiceType, isEditing, form])

  // When invoice_type changes, swap org data between supplier/customer
  const prevType = useRef(invoiceType)
  useEffect(() => {
    if (isEditing || !activeOrg || prevType.current === invoiceType) return
    prevType.current = invoiceType

    const address = [activeOrg.address_street, activeOrg.address_city, activeOrg.address_zip]
      .filter(Boolean)
      .join(", ")

    if (invoiceType === "issued") {
      // Org becomes supplier
      form.setValue("supplier_name", activeOrg.name)
      form.setValue("supplier_ico", activeOrg.ico ?? "")
      form.setValue("supplier_dic", activeOrg.dic ?? "")
      form.setValue("supplier_ic_dph", activeOrg.ic_dph ?? "")
      form.setValue("supplier_address", address)
      form.setValue("supplier_iban", activeOrg.bank_iban ?? "")
      form.setValue("bank_iban", activeOrg.bank_iban ?? "")
      // Clear customer fields (org data was there before)
      form.setValue("customer_name", "")
      form.setValue("customer_ico", "")
      form.setValue("customer_dic", "")
      form.setValue("customer_ic_dph", "")
      form.setValue("customer_address", "")
    } else {
      // Org becomes customer
      form.setValue("customer_name", activeOrg.name)
      form.setValue("customer_ico", activeOrg.ico ?? "")
      form.setValue("customer_dic", activeOrg.dic ?? "")
      form.setValue("customer_ic_dph", activeOrg.ic_dph ?? "")
      form.setValue("customer_address", address)
      // Clear supplier fields (org data was there before)
      form.setValue("supplier_name", "")
      form.setValue("supplier_ico", "")
      form.setValue("supplier_dic", "")
      form.setValue("supplier_ic_dph", "")
      form.setValue("supplier_address", "")
      form.setValue("supplier_iban", "")
      form.setValue("bank_iban", "")
    }
  }, [invoiceType, isEditing, activeOrg, form])

  function onSubmit(values: InvoiceFormValues) {
    startTransition(async () => {
      if (isEditing) {
        const result = await updateInvoiceAction(invoiceId!, values)
        if (result.error) toast.error(result.error)
        else { toast.success("Faktúra aktualizovaná"); router.push(`/invoices/${invoiceId}`) }
      } else {
        const result = await createInvoiceAction(values)
        if (result.error) toast.error(result.error)
        else { toast.success("Faktúra vytvorená"); router.push(`/invoices/${result.id}`) }
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* ── Section 1: Type & Number ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Údaje faktúry</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="invoice_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ faktúry *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="issued">Vydaná (odosielate ju)</SelectItem>
                      <SelectItem value="received">Prijatá (dostávate ju)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Číslo faktúry *
                    {!isEditing && !userEditedNumber.current && (
                      <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="2025-001"
                      {...field}
                      onChange={(e) => {
                        userEditedNumber.current = true
                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Section 2: Supplier ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Dodávateľ</h2>
          <ContactPicker
            contactType="supplier"
            onSelect={(contact: Contact) => {
              form.setValue("supplier_name", contact.name)
              form.setValue("supplier_ico", contact.ico ?? "")
              form.setValue("supplier_dic", contact.dic ?? "")
              form.setValue("supplier_ic_dph", contact.ic_dph ?? "")
              form.setValue("supplier_address", [contact.street, contact.city, contact.postal_code].filter(Boolean).join(", "))
              form.setValue("supplier_iban", contact.bank_account ?? "")
              form.setValue("contact_id", contact.id)
            }}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Názov spoločnosti *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme s.r.o." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_ico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IČO</FormLabel>
                  <FormControl>
                    <Input placeholder="12345678" maxLength={8} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_dic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DIČ</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_ic_dph"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IČ DPH</FormLabel>
                  <FormControl>
                    <Input placeholder="SK1234567890" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_iban"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IBAN</FormLabel>
                  <FormControl>
                    <Input placeholder="SK31 1200 0000 1987..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Adresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Hlavná 1, 811 01 Bratislava" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Section 3: Customer ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Odberateľ</h2>
          <ContactPicker
            contactType="client"
            onSelect={(contact: Contact) => {
              form.setValue("customer_name", contact.name)
              form.setValue("customer_ico", contact.ico ?? "")
              form.setValue("customer_dic", contact.dic ?? "")
              form.setValue("customer_ic_dph", contact.ic_dph ?? "")
              form.setValue("customer_address", [contact.street, contact.city, contact.postal_code].filter(Boolean).join(", "))
              form.setValue("contact_id", contact.id)
            }}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Názov spoločnosti *</FormLabel>
                  <FormControl>
                    <Input placeholder="Beta Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_ico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IČO</FormLabel>
                  <FormControl>
                    <Input placeholder="12345678" maxLength={8} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_dic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DIČ</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_ic_dph"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IČ DPH</FormLabel>
                  <FormControl>
                    <Input placeholder="SK1234567890" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Adresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Obchodná 5, 010 01 Žilina" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Section 4: Dates & Payment ───────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Dátumy a platba</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dátum vystavenia *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dátum dodania</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dátum splatnosti *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Spôsob úhrady</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bankový prevod</SelectItem>
                      <SelectItem value="cash">Hotovosť</SelectItem>
                      <SelectItem value="card">Kartou</SelectItem>
                      <SelectItem value="other">Iný</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bank_iban"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IBAN pre úhradu</FormLabel>
                  <FormControl>
                    <Input placeholder="SK31 1200 0000 1987..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="variable_symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variabilný symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="20250001" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="constant_symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Konštantný symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="0308" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specific_symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Špecifický symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="Nepovinné" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Section 5: Line Items ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Položky faktúry</h2>
          <InvoiceItemsEditor control={form.control} />
          {form.formState.errors.items?.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.items.root.message}
            </p>
          )}
        </section>

        <Separator />

        {/* ── Section 6: Notes ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Poznámky</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poznámka pre odberateľa</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Viditeľná na faktúre pre odberateľa…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internal_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interná poznámka</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Súkromné poznámky, nezobrazujú sa na faktúre…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="size-4 animate-spin" />}
            {isEditing ? "Uložiť zmeny" : "Vytvoriť faktúru"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Zrušiť
          </Button>
        </div>
      </form>
    </Form>
  )
}
