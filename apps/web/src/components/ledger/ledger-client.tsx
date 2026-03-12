"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  Plus,
  CheckCircle,
  Undo2,
  Trash2,
  Search,
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import {
  createJournalEntryAction,
  postJournalEntryAction,
  reverseJournalEntryAction,
  deleteJournalEntryAction,
  batchPostJournalEntriesAction,
  fetchBalancesAction,
} from "@/lib/actions/ledger"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type {
  JournalEntry,
  ChartAccount,
  AccountBalance,
  LedgerSummary,
} from "@/lib/data/ledger"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(n: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(n)
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("sk-SK")
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  posted: "bg-green-100 text-green-700",
  reversed: "bg-red-100 text-red-700",
}

const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-orange-100 text-orange-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-red-100 text-red-700",
  off_balance: "bg-gray-100 text-gray-700",
}

const classNames: Record<string, string> = {
  "0": "Long-term Assets",
  "1": "Inventories",
  "2": "Financial Accounts",
  "3": "Receivables & Payables",
  "4": "Capital & Long-term Liabilities",
  "5": "Expenses",
  "6": "Revenue",
  "7": "Closing & Off-balance",
  "8": "Internal",
  "9": "Off-balance",
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerClientProps {
  entries: JournalEntry[]
  accounts: ChartAccount[]
  balances: AccountBalance[]
  summary: LedgerSummary
}

// ─── New Entry Form State ─────────────────────────────────────────────────────

interface NewEntryForm {
  entry_date: string
  description: string
  reference_number: string
  debit_account_number: string
  credit_account_number: string
  amount: string
}

const EMPTY_FORM: NewEntryForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  description: "",
  reference_number: "",
  debit_account_number: "",
  credit_account_number: "",
  amount: "",
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LedgerClient({
  entries,
  accounts,
  balances,
  summary,
}: LedgerClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Journal tab state
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [journalSearch, setJournalSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Chart of Accounts tab state
  const [coaSearch, setCoaSearch] = useState("")

  // Balances tab state
  const currentYear = new Date().getFullYear()
  const [balanceYear, setBalanceYear] = useState(String(currentYear))
  const [balanceMonth, setBalanceMonth] = useState("all")

  const yearNum = balanceYear ? Number(balanceYear) : undefined
  const monthNum = balanceMonth !== "all" ? Number(balanceMonth) : undefined

  const { data: currentBalances } = useQuery({
    queryKey: ["ledger-balances", yearNum, monthNum],
    queryFn: () => fetchBalancesAction(yearNum, monthNum),
    initialData: balances,
  })

  // New entry dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewEntryForm>(EMPTY_FORM)

  // ── Filtered entries ──────────────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo && e.entry_date > dateTo) return false
      if (journalSearch) {
        const q = journalSearch.toLowerCase()
        const accountMatch = e.lines.some((l) => l.account_number.includes(q))
        const matches =
          e.description.toLowerCase().includes(q) ||
          (e.reference_number?.toLowerCase().includes(q) ?? false) ||
          (e.entry_number?.toLowerCase().includes(q) ?? false) ||
          accountMatch
        if (!matches) return false
      }
      return true
    })
  }, [entries, statusFilter, dateFrom, dateTo, journalSearch])

  // ── Filtered Chart of Accounts ────────────────────────────────────────────

  const filteredAccounts = useMemo(() => {
    if (!coaSearch) return accounts
    const q = coaSearch.toLowerCase()
    return accounts.filter(
      (a) =>
        a.account_number.includes(q) ||
        a.account_name.toLowerCase().includes(q)
    )
  }, [accounts, coaSearch])

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, ChartAccount[]> = {}
    for (const acc of filteredAccounts) {
      const cls = acc.account_number.charAt(0)
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(acc)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredAccounts])

  // ── Selection helpers ─────────────────────────────────────────────────────

  const draftEntries = filteredEntries.filter((e) => e.status === "draft")
  const allDraftsSelected =
    draftEntries.length > 0 && draftEntries.every((e) => selectedIds.has(e.id))

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allDraftsSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftEntries.map((e) => e.id)))
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handlePost(id: string) {
    startTransition(async () => {
      const result = await postJournalEntryAction(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Entry posted")
        router.refresh()
      }
    })
  }

  function handleReverse(id: string) {
    startTransition(async () => {
      const result = await reverseJournalEntryAction(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Entry reversed")
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteJournalEntryAction(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Entry deleted")
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        router.refresh()
      }
    })
  }

  function handleBatchPost() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startTransition(async () => {
      const result = await batchPostJournalEntriesAction(ids)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Posted ${result.postedCount} entries`)
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

  function handleCreateEntry() {
    const amount = parseFloat(form.amount)
    if (
      !form.description ||
      !form.debit_account_number ||
      !form.credit_account_number ||
      isNaN(amount) ||
      amount <= 0
    ) {
      toast.error("Please fill in all required fields")
      return
    }

    startTransition(async () => {
      const result = await createJournalEntryAction({
        entry_date: form.entry_date,
        description: form.description,
        reference_number: form.reference_number || undefined,
        lines: [
          { account_number: form.debit_account_number, debit_amount: amount, credit_amount: 0 },
          { account_number: form.credit_account_number, debit_amount: 0, credit_amount: amount },
        ],
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Entry created")
        setForm(EMPTY_FORM)
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // ── Balance totals ────────────────────────────────────────────────────────

  const balanceTotals = useMemo(() => {
    return (currentBalances ?? []).reduce(
      (acc, b) => ({
        debit: acc.debit + b.debit_total,
        credit: acc.credit + b.credit_total,
      }),
      { debit: 0, credit: 0 }
    )
  }, [currentBalances])

  // ── Active accounts for selects ───────────────────────────────────────────

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Tabs defaultValue="journal" className="space-y-4">
      <TabsList>
        <TabsTrigger value="journal">Journal</TabsTrigger>
        <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
        <TabsTrigger value="balances">Balances</TabsTrigger>
      </TabsList>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: JOURNAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="journal" className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">
                Total Entries
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {summary.totalEntries}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">Draft</p>
              <p className="text-2xl font-bold tabular-nums text-yellow-600">
                {summary.draftCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">
                Posted
              </p>
              <p className="text-2xl font-bold tabular-nums text-green-600">
                {summary.postedCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">
                Total Amount
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {formatEur(summary.totalDebit)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
              placeholder="To"
            />

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                onClick={handleBatchPost}
                disabled={isPending}
              >
                <CheckCircle className="size-4" />
                Post selected ({selectedIds.size})
              </Button>
            )}

            {/* New Entry Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  New Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Journal Entry</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="entry_date">Date</Label>
                    <Input
                      id="entry_date"
                      type="date"
                      value={form.entry_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, entry_date: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description *</Label>
                    <Input
                      id="description"
                      placeholder="e.g. Office rent payment"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="reference_number">
                      Reference Number (optional)
                    </Label>
                    <Input
                      id="reference_number"
                      placeholder="e.g. INV-2024-001"
                      value={form.reference_number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          reference_number: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="debit_account">Debit Account *</Label>
                      <Select
                        value={form.debit_account_number}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, debit_account_number: v }))
                        }
                      >
                        <SelectTrigger id="debit_account">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map((a) => (
                            <SelectItem
                              key={a.id}
                              value={a.account_number}
                            >
                              {a.account_number} — {a.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="credit_account">Credit Account *</Label>
                      <Select
                        value={form.credit_account_number}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, credit_account_number: v }))
                        }
                      >
                        <SelectTrigger id="credit_account">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map((a) => (
                            <SelectItem
                              key={a.id}
                              value={a.account_number}
                            >
                              {a.account_number} — {a.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (EUR) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEntry} disabled={isPending}>
                    Create Entry
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Journal entries table */}
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
            <BookOpen className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No journal entries yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {entries.length > 0
                ? "Try adjusting your filters."
                : "Create your first journal entry to get started."}
            </p>
            {entries.length === 0 && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                New Entry
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allDraftsSelected ||
                        (selectedIds.size > 0 && "indeterminate")
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Select all draft entries"
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead className="text-right">Amount (EUR)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    data-state={selectedIds.has(entry.id) && "selected"}
                  >
                    <TableCell>
                      {entry.status === "draft" ? (
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={() => toggleRow(entry.id)}
                          aria-label={`Select entry ${entry.reference_number ?? entry.id}`}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(entry.entry_date)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.entry_number ?? entry.reference_number ?? "\u2014"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm">
                      {entry.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.lines.map((l) => l.account_number).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-sm">
                      {formatEur(entry.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          statusColors[entry.status]
                        )}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handlePost(entry.id)}
                              disabled={isPending}
                            >
                              <CheckCircle className="size-4 mr-2" />
                              Post
                            </DropdownMenuItem>
                          )}
                          {entry.status === "posted" && (
                            <DropdownMenuItem
                              onClick={() => handleReverse(entry.id)}
                              disabled={isPending}
                            >
                              <Undo2 className="size-4 mr-2" />
                              Reverse
                            </DropdownMenuItem>
                          )}
                          {entry.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(entry.id)}
                              disabled={isPending}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: CHART OF ACCOUNTS
          ═══════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="chart" className="space-y-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={coaSearch}
            onChange={(e) => setCoaSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
            <BookOpen className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No accounts found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {coaSearch
                ? "Try adjusting your search."
                : "No chart of accounts data available."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>System</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedAccounts.map(([cls, accs]) => (
                  <CoaClassGroup key={cls} cls={cls} accounts={accs} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: BALANCES
          ═══════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="balances" className="space-y-4">
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <Select value={balanceYear} onValueChange={setBalanceYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                (y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {/* Month selector */}
          <Select value={balanceMonth} onValueChange={setBalanceMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0")
                const label = new Date(2024, i).toLocaleDateString("en-US", {
                  month: "long",
                })
                return (
                  <SelectItem key={m} value={m}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {(currentBalances ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
            <BookOpen className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No balance data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Post journal entries to see account balances.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit Total</TableHead>
                  <TableHead className="text-right">Credit Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(currentBalances ?? []).map((b) => (
                  <TableRow key={b.account_number}>
                    <TableCell className="font-mono text-sm">
                      {b.account_number}
                    </TableCell>
                    <TableCell className="text-sm">{b.account_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          typeColors[b.account_type] ?? ""
                        )}
                      >
                        {b.account_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(b.debit_total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(b.credit_total)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-medium text-sm",
                        b.balance > 0 && "text-green-600",
                        b.balance < 0 && "text-red-600"
                      )}
                    >
                      {formatEur(b.balance)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="text-sm">
                    Totals
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatEur(balanceTotals.debit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatEur(balanceTotals.credit)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums text-sm",
                      balanceTotals.debit - balanceTotals.credit > 0 &&
                        "text-green-600",
                      balanceTotals.debit - balanceTotals.credit < 0 &&
                        "text-red-600"
                    )}
                  >
                    {formatEur(balanceTotals.debit - balanceTotals.credit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

// ─── Sub-component to avoid React key issues with fragments ─────────────────

function CoaClassGroup({
  cls,
  accounts: accs,
}: {
  cls: string
  accounts: ChartAccount[]
}) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={5} className="font-semibold text-sm">
          Class {cls} — {classNames[cls] ?? "Other"}
        </TableCell>
      </TableRow>
      {accs.map((acc) => (
        <TableRow key={acc.id}>
          <TableCell className="font-mono text-sm">
            {acc.account_number}
          </TableCell>
          <TableCell className="text-sm">{acc.account_name}</TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {acc.account_class}
          </TableCell>
          <TableCell>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs capitalize",
                typeColors[acc.account_type] ?? ""
              )}
            >
              {acc.account_type.replace("_", " ")}
            </Badge>
          </TableCell>
          <TableCell>
            {acc.is_system && (
              <Badge variant="outline" className="text-xs">
                System
              </Badge>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
