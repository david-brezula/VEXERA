"use client"

import * as React from "react"
import { PackageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { searchProductsAction } from "@/lib/actions/products"
import type { Product } from "@/lib/services/products.service"

type Props = {
  onSelect: (product: Product) => void
}

export function ProductPicker({ onSelect }: Props) {
  const [open, setOpen] = React.useState(false)
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(false)
  const [fetched, setFetched] = React.useState(false)

  React.useEffect(() => {
    if (!open || fetched) return

    setLoading(true)
    searchProductsAction()
      .then((results) => {
        setProducts(results)
        setFetched(true)
      })
      .catch(() => {
        setProducts([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, fetched])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs"
        >
          <PackageIcon className="h-3.5 w-3.5" />
          Product...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search product..." />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.name}
                      onSelect={() => {
                        onSelect(product)
                        setOpen(false)
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.unit_price_net.toFixed(2)} {product.currency}/{product.unit} - VAT {product.vat_rate}%
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
