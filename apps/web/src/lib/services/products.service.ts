/**
 * Products / Service Catalog Service
 *
 * CRUD for reusable products/services used in invoicing.
 * Includes CSV import and revenue stats calculation.
 *
 * Usage:
 *   const products = await listProducts(supabase, orgId)
 *   const product = await createProduct(supabase, orgId, data)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  organization_id: string
  name: string
  description: string | null
  sku: string | null
  unit: string
  unit_price_net: number
  vat_rate: number
  currency: string
  total_revenue: number
  times_invoiced: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateProductInput {
  name: string
  description?: string | null
  sku?: string | null
  unit?: string
  unit_price_net: number
  vat_rate?: number
  currency?: string
  is_active?: boolean
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listProducts(
  supabase: SupabaseClient,
  organizationId: string,
  activeOnly: boolean = false
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as Product[]
}

export async function getProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null
  return data as unknown as Product
}

export async function createProduct(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateProductInput
): Promise<Product> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("products" as any) as any)
    .insert({
      organization_id: organizationId,
      ...input,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create product: ${error?.message ?? "unknown error"}`)
  }

  return data as Product
}

export async function updateProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  input: Partial<CreateProductInput>
): Promise<Product> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("products" as any) as any)
    .update(input)
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update product: ${error?.message ?? "unknown error"}`)
  }

  return data as Product
}

export async function deleteProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("products" as any) as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`)
  }
}

// ─── CSV Import ─────────────────────────────────────────────────────────────

/**
 * Import products from CSV text. Expected columns:
 * name, description, sku, unit, unit_price_net, vat_rate
 *
 * Returns number of products created.
 */
export async function importFromCSV(
  supabase: SupabaseClient,
  organizationId: string,
  csvText: string
): Promise<number> {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return 0

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const nameIdx = headers.indexOf("name")
  if (nameIdx === -1) throw new Error("CSV must contain a 'name' column")

  const descIdx = headers.indexOf("description")
  const skuIdx = headers.indexOf("sku")
  const unitIdx = headers.indexOf("unit")
  const priceIdx = headers.indexOf("unit_price_net")
  const vatIdx = headers.indexOf("vat_rate")

  let created = 0
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim())
    const name = cols[nameIdx]
    if (!name) continue

    const price = priceIdx >= 0 ? parseFloat(cols[priceIdx]) : 0
    if (isNaN(price)) continue

    try {
      await createProduct(supabase, organizationId, {
        name,
        description: descIdx >= 0 ? cols[descIdx] || null : null,
        sku: skuIdx >= 0 ? cols[skuIdx] || null : null,
        unit: unitIdx >= 0 ? cols[unitIdx] || "ks" : "ks",
        unit_price_net: price,
        vat_rate: vatIdx >= 0 ? parseFloat(cols[vatIdx]) || 20 : 20,
      })
      created++
    } catch {
      // Skip invalid rows
    }
  }

  return created
}

// ─── Revenue Stats ──────────────────────────────────────────────────────────

/**
 * Update total_revenue and times_invoiced for all products in an org.
 * Scans invoice_items for matching product names.
 */
export async function updateRevenueStats(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  const products = await listProducts(supabase, organizationId)
  if (products.length === 0) return

  // Fetch all invoice items for this org's invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("organization_id", organizationId)

  if (!invoices || invoices.length === 0) return

  const invoiceIds = (invoices as unknown as { id: string }[]).map((i) => i.id)

  const { data: items } = await supabase
    .from("invoice_items")
    .select("description, quantity, unit_price, total")
    .in("invoice_id", invoiceIds)

  if (!items || items.length === 0) return

  const typedItems = items as unknown as {
    description: string | null
    quantity: number | null
    unit_price: number | null
    total: number | null
  }[]

  // Match items to products by name
  for (const product of products) {
    const productNameLower = product.name.toLowerCase()
    let totalRevenue = 0
    let timesInvoiced = 0

    for (const item of typedItems) {
      if (item.description?.toLowerCase().includes(productNameLower)) {
        totalRevenue += item.total ?? 0
        timesInvoiced++
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("products" as any) as any)
      .update({
        total_revenue: Number(totalRevenue.toFixed(2)),
        times_invoiced: timesInvoiced,
      })
      .eq("id", product.id)
      .eq("organization_id", organizationId)
  }
}
