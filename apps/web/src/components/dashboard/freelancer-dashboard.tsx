import { Suspense } from "react"
import { Shield, Calculator, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatEur } from "@vexera/utils"
import { getFreelancerTaxData } from "@/lib/data/freelancer-tax"

async function TaxMeterCard({ orgId }: { orgId: string }) {
  const { taxResult, incomeYtd, taxRegime } = await getFreelancerTaxData(orgId)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Prijmy (rok k dnesu)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatEur(incomeYtd)}</p>
          <Badge variant="secondary" className="mt-2 text-xs">
            {taxRegime === "pausalne_vydavky" ? "Pausalne vydavky" : "Skutocne naklady"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Odhadovana dan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-amber-600">{formatEur(taxResult.estimatedTax)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Zaklad dane: {formatEur(taxResult.taxBase)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Vydavkovy odpocet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-emerald-600">{formatEur(taxResult.expenseDeduction)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {taxRegime === "pausalne_vydavky" ? "60 % prijmov (max 20 000 EUR)" : "Skutocne vydavky"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function InsuranceCard({ orgId }: { orgId: string }) {
  const { taxResult } = await getFreelancerTaxData(orgId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Odvody
        </CardTitle>
        <CardDescription>Mesacne platby poistneho</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Socialna poistovna (teraz)</p>
            <p className="text-xl font-bold">{formatEur(taxResult.socialMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Zdravotna poistovna (teraz)</p>
            <p className="text-xl font-bold">{formatEur(taxResult.healthMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Socialna (buduci rok)
            </p>
            <p className="text-xl font-bold text-amber-600">{formatEur(taxResult.nextYearSocialMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Zdravotna (buduci rok)
            </p>
            <p className="text-xl font-bold text-amber-600">{formatEur(taxResult.nextYearHealthMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Predikcia buducorocnych odvodov vychadza z aktualnych prijmov. Aktualizuje sa s kazdou novou fakturou.
        </p>
      </CardContent>
    </Card>
  )
}

export async function FreelancerDashboard({ orgId }: { orgId: string }) {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prehlad</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Vase dane a odvody na rok {new Date().getFullYear()}.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Danovy prehlad
        </h2>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <TaxMeterCard orgId={orgId} />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <InsuranceCard orgId={orgId} />
        </Suspense>
      </section>
    </div>
  )
}
