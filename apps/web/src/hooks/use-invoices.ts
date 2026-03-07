"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { InvoiceFormValues } from "@/lib/validations/invoice.schema"
import { calculateVatAmount, calculateGrossAmount } from "@vexera/utils"
import type { InvoiceStatus, InvoiceType, Database } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceDetail = Database["public"]["Tables"]["invoices"]["Row"] & {
  invoice_items: Database["public"]["Tables"]["invoice_items"]["Row"][]
}


export type InvoiceFilters = {
  status?: InvoiceStatus | "all"
  invoice_type?: InvoiceType | "all"
  search?: string
  date_from?: string
  date_to?: string
}

export type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_type: InvoiceType
  status: InvoiceStatus
  supplier_name: string
  customer_name: string
  issue_date: string
  due_date: string
  total: number
  currency: string
  created_at: string
}

// ─── Helper: generate next invoice number ─────────────────────────────────────

async function generateInvoiceNumber(
  supabase: ReturnType<typeof useSupabase>["supabase"],
  orgId: string,
  type: InvoiceType
): Promise<string> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("organization_id", orgId)
    .eq("invoice_type", type)
    .like("invoice_number", `${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)

  const last = data?.[0]?.invoice_number
  const lastNum = last ? parseInt(last.split("-")[1] ?? "0", 10) : 0
  return `${year}-${String(lastNum + 1).padStart(3, "0")}`
}

// ─── useInvoices ──────────────────────────────────────────────────────────────

/**
 * Fetch invoice list for the active organization.
 * Overdue detection: invoices with status "sent" and due_date < today
 * are returned with status "overdue" by the query.
 */
export function useInvoices(filters?: InvoiceFilters) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()

  return useQuery({
    queryKey: queryKeys.invoices.list(activeOrg?.id ?? "", filters),
    queryFn: async (): Promise<InvoiceRow[]> => {
      if (!activeOrg) return []

      let query = supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_type, status, supplier_name, customer_name, issue_date, due_date, total, currency, created_at"
        )
        .eq("organization_id", activeOrg.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      // Apply filters
      if (filters?.status && filters.status !== "all") {
        if (filters.status === "overdue") {
          // overdue = sent + past due date
          query = query.eq("status", "sent").lt("due_date", new Date().toISOString().slice(0, 10))
        } else {
          query = query.eq("status", filters.status)
        }
      }
      if (filters?.invoice_type && filters.invoice_type !== "all") {
        query = query.eq("invoice_type", filters.invoice_type)
      }
      if (filters?.search) {
        query = query.or(
          `invoice_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
        )
      }
      if (filters?.date_from) {
        query = query.gte("issue_date", filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte("issue_date", filters.date_to)
      }

      const { data, error } = await query
      if (error) throw error

      // Compute overdue status client-side for rows not filtered by it
      const today = new Date().toISOString().slice(0, 10)
      return (data ?? []).map((inv) => ({
        ...inv,
        status:
          inv.status === "sent" && inv.due_date < today
            ? ("overdue" as InvoiceStatus)
            : (inv.status as InvoiceStatus),
        total: Number(inv.total),
        invoice_type: inv.invoice_type as InvoiceType,
      }))
    },
    enabled: !!activeOrg,
  })
}

// ─── useInvoice ───────────────────────────────────────────────────────────────

export function useInvoice(id: string) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()

  return useQuery({
    queryKey: queryKeys.invoices.detail(activeOrg?.id ?? "", id),
    queryFn: async (): Promise<InvoiceDetail | null> => {
      if (!activeOrg) return null

      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", id)
        .eq("organization_id", activeOrg.id)
        .is("deleted_at", null)
        .single()

      if (error) throw error
      // Placeholder DB types have Relationships: [] so Supabase can't infer the
      // join type — cast explicitly. Replace with generated types via pnpm db:generate-types.
      return data as unknown as InvoiceDetail | null
    },
    enabled: !!activeOrg && !!id,
  })
}

// ─── useCreateInvoice ─────────────────────────────────────────────────────────

export function useCreateInvoice() {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      if (!activeOrg || !user) throw new Error("Not authenticated")

      // 1. Generate invoice number
      const invoice_number =
        values.invoice_number ||
        (await generateInvoiceNumber(supabase, activeOrg.id, values.invoice_type))

      // 2. Calculate totals from items
      const subtotal = values.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price_net,
        0
      )
      const vat_amount = values.items.reduce(
        (sum, item) =>
          sum + calculateVatAmount(item.quantity * item.unit_price_net, item.vat_rate),
        0
      )
      const total = subtotal + vat_amount

      // 3. Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          organization_id: activeOrg.id,
          invoice_number,
          invoice_type: values.invoice_type,
          status: "draft",
          supplier_name: values.supplier_name,
          supplier_ico: values.supplier_ico || null,
          supplier_dic: values.supplier_dic || null,
          supplier_ic_dph: values.supplier_ic_dph || null,
          supplier_address: values.supplier_address || null,
          supplier_iban: values.supplier_iban || null,
          customer_name: values.customer_name,
          customer_ico: values.customer_ico || null,
          customer_dic: values.customer_dic || null,
          customer_ic_dph: values.customer_ic_dph || null,
          customer_address: values.customer_address || null,
          issue_date: values.issue_date,
          delivery_date: values.delivery_date || null,
          due_date: values.due_date,
          payment_method: values.payment_method,
          bank_iban: values.bank_iban || null,
          variable_symbol: values.variable_symbol || null,
          constant_symbol: values.constant_symbol || null,
          specific_symbol: values.specific_symbol || null,
          notes: values.notes || null,
          internal_notes: values.internal_notes || null,
          currency: values.currency,
          subtotal: Math.round(subtotal * 100) / 100,
          vat_amount: Math.round(vat_amount * 100) / 100,
          total: Math.round(total * 100) / 100,
          created_by: user.id,
        })
        .select("id")
        .single()

      if (invoiceError) throw invoiceError

      // 4. Insert invoice items
      const items = values.items.map((item, i) => {
        const net = item.quantity * item.unit_price_net
        const vatAmt = calculateVatAmount(net, item.vat_rate)
        const gross = calculateGrossAmount(net, item.vat_rate)
        return {
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "ks",
          unit_price: item.unit_price_net,
          vat_rate: item.vat_rate,
          vat_amount: Math.round(vatAmt * 100) / 100,
          total: Math.round(gross * 100) / 100,
          sort_order: i,
        }
      })

      const { error: itemsError } = await supabase.from("invoice_items").insert(items)
      if (itemsError) throw itemsError

      // 5. Write audit log
      await supabase.from("audit_logs").insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        action: "INVOICE_CREATED",
        entity_type: "invoice",
        entity_id: invoice.id,
        new_data: { invoice_number, status: "draft", total },
      })

      return invoice.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(activeOrg?.id ?? "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(activeOrg?.id ?? "") })
      toast.success("Invoice created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useUpdateInvoice ─────────────────────────────────────────────────────────

export function useUpdateInvoice(invoiceId: string) {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      if (!activeOrg || !user) throw new Error("Not authenticated")

      const subtotal = values.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price_net,
        0
      )
      const vat_amount = values.items.reduce(
        (sum, item) =>
          sum + calculateVatAmount(item.quantity * item.unit_price_net, item.vat_rate),
        0
      )
      const total = subtotal + vat_amount

      // Update invoice
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          invoice_number: values.invoice_number,
          supplier_name: values.supplier_name,
          supplier_ico: values.supplier_ico || null,
          supplier_dic: values.supplier_dic || null,
          supplier_ic_dph: values.supplier_ic_dph || null,
          supplier_address: values.supplier_address || null,
          supplier_iban: values.supplier_iban || null,
          customer_name: values.customer_name,
          customer_ico: values.customer_ico || null,
          customer_dic: values.customer_dic || null,
          customer_ic_dph: values.customer_ic_dph || null,
          customer_address: values.customer_address || null,
          issue_date: values.issue_date,
          delivery_date: values.delivery_date || null,
          due_date: values.due_date,
          payment_method: values.payment_method,
          bank_iban: values.bank_iban || null,
          variable_symbol: values.variable_symbol || null,
          constant_symbol: values.constant_symbol || null,
          specific_symbol: values.specific_symbol || null,
          notes: values.notes || null,
          internal_notes: values.internal_notes || null,
          currency: values.currency,
          subtotal: Math.round(subtotal * 100) / 100,
          vat_amount: Math.round(vat_amount * 100) / 100,
          total: Math.round(total * 100) / 100,
          updated_by: user.id,
        })
        .eq("id", invoiceId)
        .eq("organization_id", activeOrg.id)

      if (invoiceError) throw invoiceError

      // Replace all items: delete + re-insert
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)

      const items = values.items.map((item, i) => {
        const net = item.quantity * item.unit_price_net
        const vatAmt = calculateVatAmount(net, item.vat_rate)
        const gross = calculateGrossAmount(net, item.vat_rate)
        return {
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "ks",
          unit_price: item.unit_price_net,
          vat_rate: item.vat_rate,
          vat_amount: Math.round(vatAmt * 100) / 100,
          total: Math.round(gross * 100) / 100,
          sort_order: i,
        }
      })

      const { error: itemsError } = await supabase.from("invoice_items").insert(items)
      if (itemsError) throw itemsError

      // Audit log
      await supabase.from("audit_logs").insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        action: "INVOICE_UPDATED",
        entity_type: "invoice",
        entity_id: invoiceId,
        new_data: { total },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(activeOrg?.id ?? "") })
      toast.success("Invoice updated")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useUpdateInvoiceStatus ───────────────────────────────────────────────────

export function useUpdateInvoiceStatus() {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
    }: {
      invoiceId: string
      status: InvoiceStatus
    }) => {
      if (!activeOrg || !user) throw new Error("Not authenticated")

      const update: Record<string, unknown> = { status, updated_by: user.id }
      if (status === "paid") update.paid_at = new Date().toISOString()

      const { error } = await supabase
        .from("invoices")
        .update(update)
        .eq("id", invoiceId)
        .eq("organization_id", activeOrg.id)

      if (error) throw error

      await supabase.from("audit_logs").insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        action: "INVOICE_STATUS_CHANGED",
        entity_type: "invoice",
        entity_id: invoiceId,
        new_data: { status },
      })
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(activeOrg?.id ?? "") })
      toast.success(`Invoice marked as ${status}`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useDeleteInvoice ─────────────────────────────────────────────────────────

export function useDeleteInvoice() {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!activeOrg || !user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", invoiceId)
        .eq("organization_id", activeOrg.id)

      if (error) throw error

      await supabase.from("audit_logs").insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        action: "INVOICE_DELETED",
        entity_type: "invoice",
        entity_id: invoiceId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(activeOrg?.id ?? "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(activeOrg?.id ?? "") })
      toast.success("Invoice deleted")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
