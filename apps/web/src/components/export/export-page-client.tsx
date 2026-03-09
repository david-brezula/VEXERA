"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { RefreshCw, Download, Loader2 } from "lucide-react"
import { format as fmtDate } from "date-fns"

import { useOrganization } from "@/providers/organization-provider"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExportJob, ExportFormat } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportJobWithUrl = ExportJob & { download_url?: string }

// ─── Schema ───────────────────────────────────────────────────────────────────

const exportSchema = z.object({
  format: z.enum(["pohoda", "money_s3", "kros", "csv_generic"] as const),
  period_from: z.string().min(1, "Required"),
  period_to: z.string().min(1, "Required"),
})

type ExportFormValues = z.infer<typeof exportSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: Array<{
  value: ExportFormat
  label: string
  description: string
}> = [
  { value: "pohoda", label: "Pohoda XML", description: "For Pohoda accounting software" },
  { value: "money_s3", label: "Money S3 CSV", description: "Compatible with Money S3" },
  { value: "kros", label: "KROS CSV", description: "For KROS accounting system" },
  { value: "csv_generic", label: "Generic CSV", description: "Universal spreadsheet format" },
]

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pohoda: "Pohoda XML",
  money_s3: "Money S3 CSV",
  kros: "KROS CSV",
  csv_generic: "Generic CSV",
}

function getDefaultPeriodFrom(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function getDefaultPeriodTo(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`
}

function StatusBadge({ status }: { status: ExportJob["status"] }) {
  if (status === "pending") {
    return <Badge variant="secondary">Queued</Badge>
  }
  if (status === "processing") {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Processing
      </Badge>
    )
  }
  if (status === "done") {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
        Completed
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">Failed</Badge>
  )
}

// ─── Export Form Card ─────────────────────────────────────────────────────────

function ExportFormCard({ orgId }: { orgId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportSchema) as unknown as Resolver<ExportFormValues>,
    defaultValues: {
      format: "pohoda",
      period_from: getDefaultPeriodFrom(),
      period_to: getDefaultPeriodTo(),
    },
  })

  async function onSubmit(values: ExportFormValues) {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          format: values.format,
          period_from: values.period_from,
          period_to: values.period_to,
          include_types: ["invoice_issued", "invoice_received", "receipt", "other"],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? "Export request failed")
      }

      toast.success("Export queued — you'll be notified when ready")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue export")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Export</CardTitle>
        <CardDescription>
          Select a format and date range to export your accounting data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {FORMAT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                            field.value === opt.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-input"
                          )}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {opt.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="period_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period from</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="period_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period to</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Export
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ─── Export History Card ──────────────────────────────────────────────────────

function ExportHistoryCard({ orgId }: { orgId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<ExportJobWithUrl[]>({
    queryKey: ["export-jobs", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/export?organization_id=${encodeURIComponent(orgId)}`)
      if (!res.ok) throw new Error("Failed to load export history")
      const json = await res.json()
      return (json.data ?? []) as ExportJobWithUrl[]
    },
    refetchInterval: (query) => {
      const jobs = query.state.data ?? []
      const hasProcessing = jobs.some(
        (j) => j.status === "pending" || j.status === "processing"
      )
      return hasProcessing ? 10_000 : false
    },
  })

  const jobs = data ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Export History</CardTitle>
            <CardDescription>Your recent export jobs</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading export history...
          </p>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No exports yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate your first export above.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {FORMAT_LABELS[job.format] ?? job.format}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(new Date(job.created_at), "d MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      {job.status === "done" && job.download_url ? (
                        <a
                          href={job.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Export Page Client ──────────────────────────────────────────────────

export function ExportPageClient() {
  const { activeOrg } = useOrganization()

  if (!activeOrg) {
    return (
      <p className="text-sm text-muted-foreground">No organization selected.</p>
    )
  }

  return (
    <div className="space-y-6">
      <ExportFormCard orgId={activeOrg.id} />
      <ExportHistoryCard orgId={activeOrg.id} />
    </div>
  )
}
