"use client"

import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { MoreHorizontal, Trash2, Pencil } from "lucide-react"
import type { Product } from "../service"

interface ProductTableProps {
  products: Product[]
  onEdit?: (product: Product) => void
  onDelete?: (productId: string) => void
}

export function ProductTable({ products, onEdit, onDelete }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Žiadne produkty
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Názov</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Cena</TableHead>
          <TableHead className="text-right">DPH</TableHead>
          <TableHead>Jednotka</TableHead>
          <TableHead className="text-right">Tržby</TableHead>
          <TableHead className="text-right">Použité</TableHead>
          <TableHead>Stav</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div>
                <span className="font-medium">{product.name}</span>
                {product.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {product.description}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
            <TableCell className="text-right">
              {product.unit_price_net.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {product.currency}
            </TableCell>
            <TableCell className="text-right">{product.vat_rate}%</TableCell>
            <TableCell>{product.unit}</TableCell>
            <TableCell className="text-right">
              {product.total_revenue > 0
                ? `${product.total_revenue.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €`
                : "—"}
            </TableCell>
            <TableCell className="text-right">{product.times_invoiced}x</TableCell>
            <TableCell>
              <Badge variant={product.is_active ? "default" : "secondary"}>
                {product.is_active ? "Aktívny" : "Neaktívny"}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(product)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upraviť
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete?.(product.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Odstrániť
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
