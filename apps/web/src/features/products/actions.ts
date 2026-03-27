"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { listProducts, type Product } from "@/features/products/service"

export async function searchProductsAction(): Promise<Product[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listProducts(supabase, orgId, true)
}
