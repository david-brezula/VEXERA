"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { ProductTable } from "./product-table"
import { ProductForm } from "./product-form"
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/use-products"
import type { Product } from "@/lib/services/products.service"

export function ProductsPageClient() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { data: products, isLoading } = useProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreate = (data: any) => {
    createProduct.mutate(data as Record<string, unknown>, {
      onSuccess: () => setDialogOpen(false),
    })
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdate = (data: any) => {
    if (!editingProduct) return
    updateProduct.mutate(
      { id: editingProduct.id, ...(data as Record<string, unknown>) },
      { onSuccess: () => { setDialogOpen(false); setEditingProduct(null) } }
    )
  }

  const handleDelete = (id: string) => {
    deleteProduct.mutate(id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingProduct(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nový produkt
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Načítavam...</div>
          ) : (
            <ProductTable
              products={products ?? []}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProduct(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Upraviť produkt" : "Nový produkt"}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            initialData={editingProduct ? {
              name: editingProduct.name,
              description: editingProduct.description ?? "",
              sku: editingProduct.sku ?? "",
              unit: editingProduct.unit,
              unit_price_net: editingProduct.unit_price_net,
              vat_rate: editingProduct.vat_rate,
              currency: editingProduct.currency,
              is_active: editingProduct.is_active,
            } : undefined}
            onSubmit={editingProduct ? handleUpdate : handleCreate}
            onCancel={() => { setDialogOpen(false); setEditingProduct(null) }}
            isLoading={createProduct.isPending || updateProduct.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
