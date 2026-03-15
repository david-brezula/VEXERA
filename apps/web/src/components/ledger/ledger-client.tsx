"use client"

import { useState, useTransition, useMemo, useCallback } from "react"
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
  ChevronRight,
  ChevronDown,
  Link as LinkIcon,
  X,
  Pencil,
  Lock,
  Unlock,
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
import {
  lockPeriodAction,
  unlockPeriodAction,
  lockQuarterAction,
} from "@/lib/actions/fiscal-periods"
import {
  createAccountAction,
  updateAccountAction,
  toggleAccountActiveAction,
} from "@/lib/actions/chart-of-accounts"
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
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { FiscalPeriod } from "@/lib/data/fiscal-periods"

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

const SLOVAK_MONTHS = [
  "Januar",
  "Februar",
  "Marec",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
]

const periodStatusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  locked: "bg-amber-100 text-amber-700",
  archived: "bg-gray-100 text-gray-700",
}

const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "off_balance",
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerClientProps {
  entries: JournalEntry[]
  accounts: ChartAccount[]
  balances: AccountBalance[]
  summary: LedgerSummary
  fiscalPeriods: FiscalPeriod[]
}

// ─── New Entry Form State ─────────────────────────────────────────────────────

interface EntryLine {
  key: number
  account_number: string
  debit: string
  credit: string
}

interface NewEntryForm {
  entry_date: string
  description: string
  reference_number: string
  lines: EntryLine[]
}

let lineKeyCounter = 0
function nextLineKey() {
  return ++lineKeyCounter
}

function emptyLine(): EntryLine {
  return { key: nextLineKey(), account_number: "", debit: "", credit: "" }
}

function makeEmptyForm(): NewEntryForm {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference_number: "",
    lines: [emptyLine(), emptyLine()],
  }
}

// ─── Account Form State ──────────────────────────────────────────────────────

interface AccountForm {
  account_number: string
  account_name: string
  account_type: string
  notes: string
}

const EMPTY_ACCOUNT_FORM: AccountForm = {
  account_number: "",
  account_name: "",
  account_type: "",
  notes: "",
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LedgerClient({
  entries,
  accounts,
  balances,
  summary,
  fiscalPeriods,
}: LedgerClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Journal tab state
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [journalSearch, setJournalSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Chart of Accounts tab state
  const [coaSearch, setCoaSearch] = useState("")

  // Balances tab state
  const currentYear = new Date().getFullYear()
  const [balanceYear, setBalanceYear] = useState(String(currentYear))
  const [balanceMonth, setBalanceMonth] = useState("all")

  // Periods tab state
  const [periodsYear, setPeriodsYear] = useState(String(currentYear))
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false)
  const [lockTarget, setLockTarget] = useState<{
    year: number
    month: number
    action: "lock" | "unlock"
  } | null>(null)

  const yearNum = balanceYear ? Number(balanceYear) : undefined
  const monthNum = balanceMonth !== "all" ? Number(balanceMonth) : undefined

  const { data: currentBalances } = useQuery({
    queryKey: ["ledger-balances", yearNum, monthNum],
    queryFn: () => fetchBalancesAction(yearNum, monthNum),
    initialData: balances,
  })

  // New entry dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewEntryForm>(makeEmptyForm)

  // Account dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT_FORM)

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

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Journal Actions ────────────────────────────────────────────────────────

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

  // ── New Entry Form Helpers ─────────────────────────────────────────────────

  const updateLine = useCallback(
    (key: number, field: keyof EntryLine, value: string) => {
      setForm((f) => ({
        ...f,
        lines: f.lines.map((l) =>
          l.key === key ? { ...l, [field]: value } : l
        ),
      }))
    },
    []
  )

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
  }

  function removeLine(key: number) {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => l.key !== key),
    }))
  }

  const lineTotals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const l of form.lines) {
      debit += parseFloat(l.debit) || 0
      credit += parseFloat(l.credit) || 0
    }
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    }
  }, [form.lines])

  const isBalanced = lineTotals.debit > 0 && Math.abs(lineTotals.debit - lineTotals.credit) < 0.005
  const hasEnoughLines = form.lines.length >= 2

  function handleCreateEntry() {
    if (!form.description) {
      toast.error("Description is required")
      return
    }
    if (!hasEnoughLines) {
      toast.error("At least 2 lines are required")
      return
    }
    if (!isBalanced) {
      toast.error("Debits must equal credits")
      return
    }

    const lines = form.lines
      .filter((l) => l.account_number && (parseFloat(l.debit) || parseFloat(l.credit)))
      .map((l) => ({
        account_number: l.account_number,
        debit_amount: parseFloat(l.debit) || 0,
        credit_amount: parseFloat(l.credit) || 0,
      }))

    if (lines.length < 2) {
      toast.error("At least 2 valid lines are required")
      return
    }

    startTransition(async () => {
      const result = await createJournalEntryAction({
        entry_date: form.entry_date,
        description: form.description,
        reference_number: form.reference_number || undefined,
        lines,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Entry created")
        setForm(makeEmptyForm())
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // ── Account Actions ────────────────────────────────────────────────────────

  function openAddAccount() {
    setEditingAccountId(null)
    setAccountForm(EMPTY_ACCOUNT_FORM)
    setAccountDialogOpen(true)
  }

  function openEditAccount(acc: ChartAccount) {
    setEditingAccountId(acc.id)
    setAccountForm({
      account_number: acc.account_number,
      account_name: acc.account_name,
      account_type: acc.account_type,
      notes: acc.notes ?? "",
    })
    setAccountDialogOpen(true)
  }

  function handleSaveAccount() {
    if (!accountForm.account_name || !accountForm.account_type) {
      toast.error("Please fill in all required fields")
      return
    }

    startTransition(async () => {
      if (editingAccountId) {
        const result = await updateAccountAction(editingAccountId, {
          account_name: accountForm.account_name,
          account_type: accountForm.account_type,
          notes: accountForm.notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Account updated")
          setAccountDialogOpen(false)
          router.refresh()
        }
      } else {
        if (!accountForm.account_number) {
          toast.error("Account number is required")
          return
        }
        const result = await createAccountAction({
          account_number: accountForm.account_number,
          account_name: accountForm.account_name,
          account_type: accountForm.account_type,
          notes: accountForm.notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Account created")
          setAccountDialogOpen(false)
          router.refresh()
        }
      }
    })
  }

  function handleToggleAccountActive(acc: ChartAccount) {
    startTransition(async () => {
      const result = await toggleAccountActiveAction(acc.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          acc.is_active ? "Account deactivated" : "Account activated"
        )
        router.refresh()
      }
    })
  }

  // ── Period Actions ─────────────────────────────────────────────────────────

  function confirmLockAction(year: number, month: number, action: "lock" | "unlock") {
    setLockTarget({ year, month, action })
    setLockConfirmOpen(true)
  }

  function executeLockAction() {
    if (!lockTarget) return
    const { year, month, action } = lockTarget
    setLockConfirmOpen(false)
    setLockTarget(null)

    startTransition(async () => {
      const result =
        action === "lock"
          ? await lockPeriodAction(year, month)
          : await unlockPeriodAction(year, month)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          action === "lock"
            ? `${SLOVAK_MONTHS[month - 1]} ${year} locked`
            : `${SLOVAK_MONTHS[month - 1]} ${year} unlocked`
        )
        router.refresh()
      }
    })
  }

  function handleLockQuarter(quarter: 1 | 2 | 3 | 4) {
    const year = Number(periodsYear)
    startTransition(async () => {
      const result = await lockQuarterAction(year, quarter)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Q${quarter} ${year} locked`)
        router.refresh()
      }
    })
  }

  // ── Periods data ───────────────────────────────────────────────────────────

  const periodsByMonth = useMemo(() => {
    const map = new Map<number, FiscalPeriod>()
    for (const p of fiscalPeriods) {
      if (String(p.year) === periodsYear) {
        map.set(p.month, p)
      }
    }
    return map
  }, [fiscalPeriods, periodsYear])

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
    <>
      <Tabs defaultValue="journal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
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
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open)
                  if (!open) setForm(makeEmptyForm())
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" />
                    New Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New Journal Entry</DialogTitle>
                    <DialogDescription>
                      Create a compound journal entry with multiple lines. Debits must equal credits.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 gap-4">
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
                        <Label htmlFor="reference_number">Reference</Label>
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
                    </div>

                    {/* Lines table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.lines.map((line) => (
                            <TableRow key={line.key}>
                              <TableCell>
                                <Select
                                  value={line.account_number}
                                  onValueChange={(v) =>
                                    updateLine(line.key, "account_number", v)
                                  }
                                >
                                  <SelectTrigger>
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
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={line.debit}
                                  onChange={(e) =>
                                    updateLine(line.key, "debit", e.target.value)
                                  }
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={line.credit}
                                  onChange={(e) =>
                                    updateLine(line.key, "credit", e.target.value)
                                  }
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell>
                                {form.lines.length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => removeLine(line.key)}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Totals row */}
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell className="text-sm">Totals</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatEur(lineTotals.debit)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatEur(lineTotals.credit)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addLine}
                      className="w-fit"
                    >
                      <Plus className="size-4" />
                      Add line
                    </Button>

                    {lineTotals.debit > 0 &&
                      !isBalanced && (
                        <p className="text-sm text-red-600">
                          Debits ({formatEur(lineTotals.debit)}) do not equal
                          credits ({formatEur(lineTotals.credit)})
                        </p>
                      )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateEntry}
                      disabled={isPending || !isBalanced || !hasEnoughLines}
                    >
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
                    <TableHead className="w-8" />
                    <TableHead>Date</TableHead>
                    <TableHead>Entry #</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const isExpanded = expandedIds.has(entry.id)
                    return (
                      <JournalEntryRows
                        key={entry.id}
                        entry={entry}
                        isExpanded={isExpanded}
                        isSelected={selectedIds.has(entry.id)}
                        isPending={isPending}
                        onToggleExpand={() => toggleExpanded(entry.id)}
                        onToggleSelect={() => toggleRow(entry.id)}
                        onPost={() => handlePost(entry.id)}
                        onReverse={() => handleReverse(entry.id)}
                        onDelete={() => handleDelete(entry.id)}
                      />
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: CHART OF ACCOUNTS
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="chart" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button onClick={openAddAccount}>
              <Plus className="size-4" />
              Add Account
            </Button>
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
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedAccounts.map(([cls, accs]) => (
                    <CoaClassGroup
                      key={cls}
                      cls={cls}
                      accounts={accs}
                      onEdit={openEditAccount}
                      onToggleActive={handleToggleAccountActive}
                      isPending={isPending}
                    />
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

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: PERIODS
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="periods" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Select value={periodsYear} onValueChange={setPeriodsYear}>
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

            <div className="flex items-center gap-2">
              {([1, 2, 3, 4] as const).map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLockQuarter(q)}
                  disabled={isPending}
                >
                  <Lock className="size-3" />
                  Lock Q{q}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const period = periodsByMonth.get(month)
                  const status = period?.status ?? "open"
                  return (
                    <TableRow key={month}>
                      <TableCell className="text-sm font-medium">
                        {SLOVAK_MONTHS[month - 1]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs capitalize",
                            periodStatusColors[status] ?? ""
                          )}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {status === "open" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              confirmLockAction(
                                Number(periodsYear),
                                month,
                                "lock"
                              )
                            }
                            disabled={isPending}
                          >
                            <Lock className="size-3" />
                            Lock
                          </Button>
                        )}
                        {status === "locked" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              confirmLockAction(
                                Number(periodsYear),
                                month,
                                "unlock"
                              )
                            }
                            disabled={isPending}
                          >
                            <Unlock className="size-3" />
                            Unlock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════
          ACCOUNT DIALOG (shared between Add & Edit)
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccountId ? "Edit Account" : "Add Account"}
            </DialogTitle>
            <DialogDescription>
              {editingAccountId
                ? "Update the account details. Account number cannot be changed."
                : "Create a new account in the chart of accounts."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="acc_number">Account Number *</Label>
              <Input
                id="acc_number"
                placeholder="e.g. 221000"
                value={accountForm.account_number}
                onChange={(e) =>
                  setAccountForm((f) => ({
                    ...f,
                    account_number: e.target.value,
                  }))
                }
                disabled={!!editingAccountId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc_name">Account Name *</Label>
              <Input
                id="acc_name"
                placeholder="e.g. Bank accounts"
                value={accountForm.account_name}
                onChange={(e) =>
                  setAccountForm((f) => ({
                    ...f,
                    account_name: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc_type">Account Type *</Label>
              <Select
                value={accountForm.account_type}
                onValueChange={(v) =>
                  setAccountForm((f) => ({ ...f, account_type: v }))
                }
              >
                <SelectTrigger id="acc_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc_notes">Notes</Label>
              <Textarea
                id="acc_notes"
                placeholder="Optional notes..."
                value={accountForm.notes}
                onChange={(e) =>
                  setAccountForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAccountDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAccount} disabled={isPending}>
              {editingAccountId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          LOCK CONFIRMATION DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {lockTarget?.action === "lock" ? "Lock Period" : "Unlock Period"}
            </DialogTitle>
            <DialogDescription>
              {lockTarget?.action === "lock"
                ? `Lock ${SLOVAK_MONTHS[(lockTarget?.month ?? 1) - 1]} ${lockTarget?.year}? Draft entries must be posted or deleted first.`
                : `Unlock ${SLOVAK_MONTHS[(lockTarget?.month ?? 1) - 1]} ${lockTarget?.year}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLockConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={executeLockAction}
              disabled={isPending}
              variant={lockTarget?.action === "lock" ? "default" : "outline"}
            >
              {lockTarget?.action === "lock" ? "Lock" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Journal Entry Row Sub-component ─────────────────────────────────────────

function JournalEntryRows({
  entry,
  isExpanded,
  isSelected,
  isPending,
  onToggleExpand,
  onToggleSelect,
  onPost,
  onReverse,
  onDelete,
}: {
  entry: JournalEntry
  isExpanded: boolean
  isSelected: boolean
  isPending: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onPost: () => void
  onReverse: () => void
  onDelete: () => void
}) {
  return (
    <>
      <TableRow data-state={isSelected && "selected"}>
        <TableCell>
          {entry.status === "draft" ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              aria-label={`Select entry ${entry.reference_number ?? entry.id}`}
            />
          ) : null}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
          {formatDate(entry.entry_date)}
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">
          {entry.entry_number ?? "\u2014"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {entry.reference_number ?? "\u2014"}
            {entry.invoice_id && (
              <a
                href={`/invoices/${entry.invoice_id}`}
                className="text-blue-600 hover:text-blue-800"
                title="View linked invoice"
                onClick={(e) => e.stopPropagation()}
              >
                <LinkIcon className="size-3" />
              </a>
            )}
          </span>
        </TableCell>
        <TableCell className="max-w-[240px] truncate text-sm">
          {entry.description}
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
                  onClick={onPost}
                  disabled={isPending}
                >
                  <CheckCircle className="size-4 mr-2" />
                  Post
                </DropdownMenuItem>
              )}
              {entry.status === "posted" && (
                <DropdownMenuItem
                  onClick={onReverse}
                  disabled={isPending}
                >
                  <Undo2 className="size-4 mr-2" />
                  Reverse
                </DropdownMenuItem>
              )}
              {entry.status === "draft" && (
                <DropdownMenuItem
                  onClick={onDelete}
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

      {/* Expanded line items */}
      {isExpanded &&
        entry.lines.map((line) => (
          <TableRow key={line.id} className="bg-muted/30">
            <TableCell />
            <TableCell />
            <TableCell colSpan={2} className="font-mono text-xs pl-8">
              {line.account_number}
              {line.account_name && (
                <span className="text-muted-foreground ml-2">
                  {line.account_name}
                </span>
              )}
            </TableCell>
            <TableCell />
            <TableCell className="text-right tabular-nums text-xs text-green-700">
              {line.debit_amount > 0 ? formatEur(line.debit_amount) : ""}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs text-red-700">
              {line.credit_amount > 0 ? formatEur(line.credit_amount) : ""}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        ))}
    </>
  )
}

// ─── Chart of Accounts Group Sub-component ───────────────────────────────────

function CoaClassGroup({
  cls,
  accounts: accs,
  onEdit,
  onToggleActive,
  isPending,
}: {
  cls: string
  accounts: ChartAccount[]
  onEdit: (acc: ChartAccount) => void
  onToggleActive: (acc: ChartAccount) => void
  isPending: boolean
}) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={6} className="font-semibold text-sm">
          Class {cls} — {classNames[cls] ?? "Other"}
        </TableCell>
      </TableRow>
      {accs.map((acc) => (
        <TableRow
          key={acc.id}
          className={cn(!acc.is_active && "opacity-50")}
        >
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
          <TableCell>
            {!acc.is_system && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onEdit(acc)}
                  disabled={isPending}
                  title="Edit account"
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onToggleActive(acc)}
                  disabled={isPending}
                  title={acc.is_active ? "Deactivate" : "Activate"}
                >
                  {acc.is_active ? (
                    <X className="size-3 text-red-500" />
                  ) : (
                    <CheckCircle className="size-3 text-green-500" />
                  )}
                </Button>
              </div>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
