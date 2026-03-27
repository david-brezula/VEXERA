// ─── Service & Types ────────────────────────────────────────────────────────
export {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  importFromCSV,
  updateRevenueStats,
} from "./service"

export type { Product, CreateProductInput } from "./service"

// ─── Hooks ──────────────────────────────────────────────────────────────────
export {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "./hooks"

// ─── Components ─────────────────────────────────────────────────────────────
export { ProductForm } from "./components/product-form"
export { ProductTable } from "./components/product-table"
export { ProductsPageClient } from "./components/products-page-client"
