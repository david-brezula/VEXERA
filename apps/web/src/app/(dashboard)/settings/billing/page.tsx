import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fakturácia</h1>
        <p className="text-muted-foreground">
          Spravujte predplatné a platobné metódy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktuálny plán</CardTitle>
          <CardDescription>
            Momentálne používate bezplatný plán.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Správa predplatného bude dostupná v budúcej aktualizácii.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
