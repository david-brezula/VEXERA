"use client"

import { useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  invoiceSchema,
  defaultInvoiceValues,
  type InvoiceFormValues,
} from "@/lib/validations/invoice.schema"
import { createInvoiceAction, updateInvoiceAction } from "@/lib/actions/invoices"
import { InvoiceItemsEditor } from "@/components/invoices/invoice-items-editor"
import { ContactPicker } from "@/components/invoices/contact-picker"
import type { Contact } from "@/lib/services/contacts.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type Props = {
  /** Pass existing invoice data to pre-fill the form for editing */
  defaultValues?: Partial<InvoiceFormValues>
  /** If editing, pass the invoice ID */
  invoiceId?: string
}

export function InvoiceForm({ defaultValues, invoiceId }: Props) {
  const router = useRouter()
  const isEditing = !!invoiceId

  const form = useForm<InvoiceFormValues>({
    // Cast resolver to avoid @hookform/resolvers v5 + Zod v4 generic type mismatch
    resolver: zodResolver(invoiceSchema) as unknown as Resolver<InvoiceFormValues>,
    defaultValues: defaultValues ?? defaultInvoiceValues("issued"),
  })

  const [isPending, startTransition] = useTransition()

  function onSubmit(values: InvoiceFormValues) {
    startTransition(async () => {
      if (isEditing) {
        const result = await updateInvoiceAction(invoiceId!, values)
        if (result.error) toast.error(result.error)
        else { toast.success("Invoice updated"); router.push(`/invoices/${invoiceId}`) }
      } else {
        const result = await createInvoiceAction(values)
        if (result.error) toast.error(result.error)
        else { toast.success("Invoice created"); router.push(`/invoices/${result.id}`) }
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* ── Section 1: Type & Number ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Invoice details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="invoice_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="issued">Issued (you send it)</SelectItem>
                      <SelectItem value="received">Received (you get it)</SelectItem>
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
                  <FormLabel>Invoice number *</FormLabel>
                  <FormControl>
                    <Input placeholder="2025-001" {...field} />
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
          <h2 className="text-lg font-semibold">Supplier (Dodávateľ)</h2>
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
                  <FormLabel>Company name *</FormLabel>
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
                  <FormLabel>Address</FormLabel>
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
          <h2 className="text-lg font-semibold">Customer (Odberateľ)</h2>
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
                  <FormLabel>Company name *</FormLabel>
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
                  <FormLabel>Address</FormLabel>
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
          <h2 className="text-lg font-semibold">Dates & payment</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue date *</FormLabel>
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
                  <FormLabel>Delivery date</FormLabel>
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
                  <FormLabel>Due date *</FormLabel>
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
                  <FormLabel>Payment method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                  <FormLabel>Payment IBAN</FormLabel>
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
                  <FormLabel>Variable symbol</FormLabel>
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
                  <FormLabel>Constant symbol</FormLabel>
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
                  <FormLabel>Specific symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Section 5: Line Items ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Line items</h2>
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
          <h2 className="text-lg font-semibold">Notes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer note</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Visible on the invoice to the customer…"
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
                  <FormLabel>Internal note</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Private notes, not shown on the invoice…"
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
            {isEditing ? "Save changes" : "Create invoice"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
