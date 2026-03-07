import { Suspense } from "react"
import Link from "next/link"
import {
  FileText,
  FolderOpen,
  TrendingUp,
  Landmark,
  Zap,
  Download,
  ArrowRight,
  Upload,
  CheckCircle,
  Inbox as InboxIcon,
} from "lucide-react"

import { getActiveOrgId } from "@/lib/data/org"
import { getDashboardStats, type DashboardStats } from "@/lib/data/dashboard"
import { getFinancialStats } from "@/lib/data/financial-stats"
import { getCashFlowData } from "@/lib/data/cashflow"
import { getCurrentQuarterVat, getVatTimeline } from "@/lib/data/vat"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { FinancialOverview } from "@/components/dashboard/financial-overview"
import { CashFlowWidget } from "@/components/dashboard/cashflow-widget"
import { VatWidget } from "@/components/dashboard/vat-widget"

// ─── Stats cards ──────────────────────────────────────────────────────────────

async function DashboardStatsCards({ orgId }: { orgId: string }) {
  const stats = await getDashboardStats(orgId)
  return <StatCards stats={stats} />
}

function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.invoiceCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.overdueCount > 0 && (
              <span className="text-destructive font-medium">
                {stats.overdueCount} overdue ·{" "}
              </span>
            )}
            {stats.invoiceCount === 1 ? "invoice" : "invoices"} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documents</CardTitle>
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.documentCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.documentCount === 1 ? "document" : "documents"} uploaded
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatEur(stats.monthlyRevenue)}</div>
          <p className="text-xs text-muted-foreground">Paid invoices this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          <FileText className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{stats.overdueCount}</div>
          <p className="text-xs text-muted-foreground">
            {formatEur(stats.overdueAmount)} outstanding
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-2">
        <Link href="/invoices/new">
          <Button size="sm">
            <FileText className="h-4 w-4 mr-2" /> New Invoice
          </Button>
        </Link>
        <Link href="/documents">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" /> Upload Document
          </Button>
        </Link>
        <Link href="/bank?tab=import">
          <Button variant="outline" size="sm">
            <Landmark className="h-4 w-4 mr-2" /> Import Statement
          </Button>
        </Link>
        <Link href="/rules">
          <Button variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" /> Add Rule
          </Button>
        </Link>
        <Link href="/inbox">
          <Button size="sm" variant="outline">
            <InboxIcon className="h-4 w-4 mr-2" /> Inbox
          </Button>
        </Link>
        <Link href="/onboarding">
          <Button variant="outline" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" /> Setup Guide
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Feature cards ────────────────────────────────────────────────────────────

function FeatureCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Bank */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-500/10 p-2">
              <Landmark className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Bank</CardTitle>
              <CardDescription className="text-xs">Transactions & reconciliation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Import bank statements, auto-match transactions to invoices, and review
            reconciliation suggestions.
          </p>
          <div className="flex flex-col gap-1.5">
            <Link href="/bank?tab=transactions">
              <Button variant="outline" size="sm" className="w-full justify-between">
                View Transactions <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Link href="/bank?tab=import">
              <Button variant="outline" size="sm" className="w-full justify-between">
                <Upload className="h-3 w-3 mr-1" /> Import Statement <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Link href="/bank?tab=reconcile">
              <Button variant="outline" size="sm" className="w-full justify-between">
                <CheckCircle className="h-3 w-3 mr-1" /> Reconcile <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-purple-500/10 p-2">
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base">Rules</CardTitle>
              <CardDescription className="text-xs">Automation engine</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create IF/THEN rules to automatically categorize documents and transactions
            based on supplier, amount, or description.
          </p>
          <div className="flex flex-col gap-1.5">
            <Link href="/rules">
              <Button variant="outline" size="sm" className="w-full justify-between">
                Manage Rules <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Link href="/rules">
              <Button variant="outline" size="sm" className="w-full justify-between">
                <Zap className="h-3 w-3 mr-1" /> Create New Rule <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-green-500/10 p-2">
              <Download className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription className="text-xs">Accounting software</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export accounting data to Pohoda XML, Money S3 CSV, or generic CSV
            for your accountant.
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="secondary" className="text-xs">Pohoda</Badge>
            <Badge variant="secondary" className="text-xs">Money S3</Badge>
            <Badge variant="secondary" className="text-xs">KROS</Badge>
            <Badge variant="secondary" className="text-xs">CSV</Badge>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="w-full justify-between">
              <Download className="h-3 w-3 mr-1" /> Export Data <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Financial Overview Section ───────────────────────────────────────────────

async function FinancialOverviewSection({ orgId }: { orgId: string }) {
  const stats = await getFinancialStats(orgId)
  return <FinancialOverview stats={stats} />
}

// ─── Cash Flow Section ───────────────────────────────────────────────────────

async function CashFlowSection({ orgId }: { orgId: string }) {
  const { summary, forecast } = await getCashFlowData(orgId)
  return <CashFlowWidget summary={summary} forecast={forecast} />
}

// ─── VAT Section ─────────────────────────────────────────────────────────────

async function VatSection({ orgId }: { orgId: string }) {
  const [current, timeline] = await Promise.all([
    getCurrentQuarterVat(orgId),
    getVatTimeline(orgId),
  ])
  return <VatWidget current={current} timeline={timeline} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const orgId = await getActiveOrgId()

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <h2 className="text-2xl font-bold">Welcome to Vexera</h2>
        <p className="text-muted-foreground">
          Create your first organization to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your accounting data</p>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStatsCards orgId={orgId} />
      </Suspense>

      <QuickActions />

      <div>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <FinancialOverviewSection orgId={orgId} />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CashFlowSection orgId={orgId} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <VatSection orgId={orgId} />
      </Suspense>

      <div>
        <h2 className="text-lg font-semibold mb-3">Features</h2>
        <FeatureCards />
      </div>
    </div>
  )
}
