import Link from "next/link"
import { BarChart3, Users, FolderKanban, Clock, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

export const metadata = {
  title: "Reports | Vexera",
}

const reportTypes = [
  {
    title: "Kategórie nákladov a výnosov",
    description: "Rozdelenie nákladov a výnosov podľa kategórií s drill-down na doklady.",
    href: "/reports/categories",
    icon: BarChart3,
  },
  {
    title: "P&L podľa klientov",
    description: "Ziskovosť podľa klientov — tržby, náklady a marža.",
    href: "/reports/client-pl",
    icon: Users,
  },
  {
    title: "P&L podľa projektov",
    description: "Ziskovosť podľa projektov — sledovanie rentability.",
    href: "/reports/project-pl",
    icon: FolderKanban,
  },
  {
    title: "Zostatok práce",
    description: "Stav pripravenosti klientov pred daňovými termínmi.",
    href: "/reports/remaining-work",
    icon: Clock,
  },
  {
    title: "Cashflow Forecast",
    description: "90-day cashflow projection with scenario analysis and risk detection.",
    href: "/reports/cashflow",
    icon: TrendingUp,
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prehľady</h1>
        <p className="text-muted-foreground mt-1">
          Detailné reporty a analýzy vašej firmy
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reportTypes.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <report.icon className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
