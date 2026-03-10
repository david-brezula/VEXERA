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
  AlertCircle,
} from "lucide-react"

import { redirect } from "next/navigation"
import { getActiveOrgId, getActiveOrg } from "@/lib/data/org"
import { FreelancerDashboard } from "@/components/dashboard/freelancer-dashboard"
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
import { cn } from "@/lib/utils"

// ─── Stat cards ───────────────────────────────────────────────────────────────

interface StatCardConfig {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  valueColor?: string
}

function StatCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, valueColor }: StatCardConfig) {
  return (
    <Card className="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {title}
            </p>
            <p className={cn("text-2xl font-bold tracking-tight", valueColor)}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function DashboardStatsCards({ orgId }: { orgId: string }) {
  const stats = await getDashboardStats(orgId)
  return <StatCards stats={stats} />
}

function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Invoices"
        value={stats.invoiceCount}
        subtitle={`${stats.invoiceCount === 1 ? "invoice" : "invoices"} total`}
        icon={FileText}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatCard
        title="Documents"
        value={stats.documentCount}
        subtitle={`${stats.documentCount === 1 ? "document" : "documents"} uploaded`}
        icon={FolderOpen}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-500"
      />
      <StatCard
        title="Revenue (MTD)"
        value={formatEur(stats.monthlyRevenue)}
        subtitle="Paid invoices this month"
        icon={TrendingUp}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-500"
      />
      <StatCard
        title="Overdue"
        value={stats.overdueCount}
        subtitle={`${formatEur(stats.overdueAmount)} outstanding`}
        icon={AlertCircle}
        iconBg={stats.overdueCount > 0 ? "bg-destructive/10" : "bg-muted"}
        iconColor={stats.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}
        valueColor={stats.overdueCount > 0 ? "text-destructive" : undefined}
      />
    </div>
  )
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { href: "/invoices/new", label: "New Invoice", icon: FileText, primary: true },
    { href: "/documents", label: "Upload Document", icon: Upload, primary: false },
    { href: "/bank?tab=import", label: "Import Statement", icon: Landmark, primary: false },
    { href: "/rules", label: "Add Rule", icon: Zap, primary: false },
    { href: "/inbox", label: "Inbox", icon: InboxIcon, primary: false },
    { href: "/onboarding", label: "Setup Guide", icon: CheckCircle, primary: false },
  ]

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button
              size="sm"
              variant={action.primary ? "default" : "outline"}
              className={cn(
                "gap-1.5 font-medium",
                !action.primary && "bg-background hover:bg-accent"
              )}
            >
              <action.icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Feature cards ────────────────────────────────────────────────────────────

function FeatureCards() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Features
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Bank */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 group">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
                <Landmark className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Bank</CardTitle>
                <CardDescription className="text-xs">Transactions & reconciliation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Import statements, auto-match transactions to invoices, and review reconciliation suggestions.
            </p>
            <div className="flex flex-col gap-1.5">
              <Link href="/bank?tab=transactions">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  View Transactions <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/bank?tab=import">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><Upload className="h-3 w-3" /> Import Statement</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/bank?tab=reconcile">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Reconcile</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 group">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 group-hover:bg-violet-500/15 transition-colors">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Rules</CardTitle>
                <CardDescription className="text-xs">Automation engine</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create IF/THEN rules to automatically categorize documents and transactions based on supplier, amount, or description.
            </p>
            <div className="flex flex-col gap-1.5">
              <Link href="/rules">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  Manage Rules <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/rules">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Create New Rule</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 group">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
                <Download className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Export</CardTitle>
                <CardDescription className="text-xs">Accounting software</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Export accounting data to Pohoda XML, Money S3 CSV, or generic CSV for your accountant.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {["Pohoda", "Money S3", "KROS", "CSV"].map((fmt) => (
                <Badge key={fmt} variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                  {fmt}
                </Badge>
              ))}
            </div>
            <Link href="/export">
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                <span className="flex items-center gap-1.5"><Download className="h-3 w-3" /> Export Data</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
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
  const org = await getActiveOrg()

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Welcome to Vexera</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Create your first organization to get started.
          </p>
        </div>
      </div>
    )
  }

  // Route to type-specific dashboards
  if (org.organization_type === "accounting_firm") {
    redirect("/accountant")
  }

  if (org.organization_type === "freelancer") {
    return <FreelancerDashboard orgId={org.id} />
  }

  // Company dashboard (default) — existing content below
  const orgId = org.id

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good morning</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Here&apos;s what&apos;s happening with your finances.
        </p>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStatsCards orgId={orgId} />
      </Suspense>

      <QuickActions />

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <FinancialOverviewSection orgId={orgId} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <CashFlowSection orgId={orgId} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <VatSection orgId={orgId} />
      </Suspense>

      <FeatureCards />
    </div>
  )
}
