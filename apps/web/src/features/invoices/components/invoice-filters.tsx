"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { Input } from "@/shared/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"

export function InvoiceFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "all") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative w-64">
        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Hľadať faktúry…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          className="pl-8"
        />
      </div>

      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Všetky stavy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všetky stavy</SelectItem>
          <SelectItem value="draft">Koncept</SelectItem>
          <SelectItem value="sent">Odoslaná</SelectItem>
          <SelectItem value="paid">Zaplatená</SelectItem>
          <SelectItem value="overdue">Po splatnosti</SelectItem>
          <SelectItem value="cancelled">Zrušená</SelectItem>
          <SelectItem value="closed">Uzavretá</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("type") ?? "all"}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Všetky typy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všetky typy</SelectItem>
          <SelectItem value="issued">Vydané</SelectItem>
          <SelectItem value="received">Prijaté</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-40"
        defaultValue={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
      />
      <Input
        type="date"
        className="w-40"
        defaultValue={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
      />
    </div>
  )
}
