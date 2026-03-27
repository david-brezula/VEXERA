export type PaginationParams = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const DEFAULT_PAGE_SIZE = 50

export function paginationRange(params?: PaginationParams): {
  from: number
  to: number
  page: number
  pageSize: number
} {
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params?.pageSize ?? DEFAULT_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to, page, pageSize }
}
