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
import { getActiveOrgId, getActiveOrg } from "@/features/settings/data-org"
import { FreelancerDashboard } from "@/features/reports/dashboard/components/freelancer-dashboard"
import { getDashboardStats, type DashboardStats } from "@/features/reports/dashboard/data"
import { getFinancialStats } from "@/features/reports/dashboard/financial-stats"
import { getCashFlowData } from "@/features/reports/cashflow/data"
import { getCurrentQuarterVat, getVatTimeline } from "@/features/reports/vat/data"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Badge } from "@/shared/components/ui/badge"
import { FinancialOverview } from "@/features/reports/dashboard/components/financial-overview"
import { CashFlowWidget } from "@/features/reports/dashboard/components/cashflow-widget"
import { VatWidget } from "@/features/reports/dashboard/components/vat-widget"
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
    <Card className="relative overflow-hidden hover:shadow-xl hover:bg-white/80 dark:hover:bg-white/8 transition-all duration-200">
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
        title="Celkom faktúr"
        value={stats.invoiceCount}
        subtitle={`${stats.invoiceCount === 1 ? "faktúra" : "faktúry"} celkom`}
        icon={FileText}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatCard
        title="Doklady"
        value={stats.documentCount}
        subtitle={`${stats.documentCount === 1 ? "doklad" : "dokladov"} nahraných`}
        icon={FolderOpen}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-500"
      />
      <StatCard
        title="Príjmy (tento mesiac)"
        value={formatEur(stats.monthlyRevenue)}
        subtitle="Zaplatené faktúry tento mesiac"
        icon={TrendingUp}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-500"
      />
      <StatCard
        title="Po splatnosti"
        value={stats.overdueCount}
        subtitle={`${formatEur(stats.overdueAmount)} neuhradených`}
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
    { href: "/invoices/new", label: "Nová faktúra", icon: FileText, primary: true },
    { href: "/documents", label: "Nahrať doklad", icon: Upload, primary: false },
    { href: "/bank?tab=import", label: "Importovať výpis", icon: Landmark, primary: false },
    { href: "/rules", label: "Pridať pravidlo", icon: Zap, primary: false },
    { href: "/inbox", label: "Doručené", icon: InboxIcon, primary: false },
    { href: "/onboarding", label: "Sprievodca nastavením", icon: CheckCircle, primary: false },
  ]

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Rýchle akcie
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button
              size="sm"
              variant={action.primary ? "default" : "outline"}
              className={cn(
                "gap-1.5 font-medium",
                !action.primary && "bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:bg-white/70 dark:hover:bg-white/10"
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
        Funkcie
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Bank */}
        <Card className="hover:shadow-xl hover:bg-white/80 dark:hover:bg-white/8 transition-all duration-200 group cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
                <Landmark className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Banka</CardTitle>
                <CardDescription className="text-xs">Transakcie a párovanie</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Importujte výpisy, automaticky párujte transakcie s faktúrami a kontrolujte návrhy párovania.
            </p>
            <div className="flex flex-col gap-1.5">
              <Link href="/bank?tab=transactions">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  Zobraziť transakcie <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/bank?tab=import">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><Upload className="h-3 w-3" /> Importovať výpis</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/bank?tab=reconcile">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Párovať</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="hover:shadow-xl hover:bg-white/80 dark:hover:bg-white/8 transition-all duration-200 group cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 group-hover:bg-violet-500/15 transition-colors">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Pravidlá</CardTitle>
                <CardDescription className="text-xs">Automatizácia</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vytvorte pravidlá AK/TAK na automatickú kategorizáciu dokladov a transakcií podľa dodávateľa, sumy alebo popisu.
            </p>
            <div className="flex flex-col gap-1.5">
              <Link href="/rules">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  Spravovať pravidlá <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/rules">
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 hover:bg-accent">
                  <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Vytvoriť pravidlo</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card className="hover:shadow-xl hover:bg-white/80 dark:hover:bg-white/8 transition-all duration-200 group cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
                <Download className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Export</CardTitle>
                <CardDescription className="text-xs">Účtovný softvér</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Exportujte účtovné dáta do formátov Pohoda XML, Money S3 CSV alebo všeobecného CSV pre vášho účtovníka.
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
                <span className="flex items-center gap-1.5"><Download className="h-3 w-3" /> Exportovať dáta</span>
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
          <h2 className="text-xl font-semibold">Vitajte vo Vexere</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Vytvorte si prvú organizáciu.
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
        <h1 className="text-2xl font-bold tracking-tight">Dobré ráno</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Tu je prehľad vašich financií.
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
