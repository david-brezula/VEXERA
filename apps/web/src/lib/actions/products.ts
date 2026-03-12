"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { listProducts, type Product } from "@/lib/services/products.service"

export async function searchProductsAction(): Promise<Product[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listProducts(supabase, orgId, true)
}
