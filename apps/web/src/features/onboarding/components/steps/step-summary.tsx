"use client"

import { Pencil } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { WizardFormValues } from "../../schemas"
import { Button } from "@/shared/components/ui/button"

function SummarySection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string
  step: number
  onEdit: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(step)}
          className="h-8 gap-1.5 text-xs"
        >
          <Pencil className="h-3 w-3" />
          Upravit
        </Button>
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export function StepSummary({
  form,
  onEditStep,
  isFirstYear,
  showInsuranceStep,
}: {
  form: UseFormReturn<WizardFormValues>
  onEditStep: (step: number) => void
  isFirstYear: boolean
  showInsuranceStep: boolean
}) {
  const values = form.getValues()

  const taxRegimeLabel =
    values.tax_regime === "pausalne_vydavky"
      ? "Pausalne vydavky (60%)"
      : "Skutocne naklady"

  const addressParts = [
    values.address_street,
    values.address_city,
    values.address_zip,
  ].filter(Boolean)
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "-"

  const personalStatuses: string[] = []
  if (values.is_student) personalStatuses.push("Student")
  if (values.is_disabled) personalStatuses.push("ZTP")
  if (values.is_pensioner) personalStatuses.push("Dochodca")
  if (values.has_other_employment) personalStatuses.push("Zamestnanec")

  return (
    <div className="space-y-5">
      {/* Business Identity */}
      <SummarySection title="Obchodne udaje" step={1} onEdit={onEditStep}>
        <SummaryRow label="Nazov" value={values.name || "-"} />
        <SummaryRow label="ICO" value={values.ico || "-"} />
        {values.dic && <SummaryRow label="DIC" value={values.dic} />}
        {values.ic_dph && <SummaryRow label="IC DPH" value={values.ic_dph} />}
        <SummaryRow label="Adresa" value={fullAddress} />
      </SummarySection>

      {/* Business Details */}
      <SummarySection title="Detail podnikania" step={2} onEdit={onEditStep}>
        <SummaryRow
          label="Datum zalozenia"
          value={values.founding_date || "-"}
        />
        <SummaryRow label="Danovy rezim" value={taxRegimeLabel} />
        <SummaryRow
          label="Platca DPH"
          value={values.registered_dph ? "Ano" : "Nie"}
        />
        <SummaryRow
          label="Prvy rok podnikania"
          value={isFirstYear ? "Ano" : "Nie"}
        />
      </SummarySection>

      {/* Personal Status */}
      <SummarySection title="Osobny status" step={3} onEdit={onEditStep}>
        {personalStatuses.length > 0 ? (
          <p className="font-medium">{personalStatuses.join(", ")}</p>
        ) : (
          <p className="text-muted-foreground">Ziadne specialne statusy</p>
        )}
      </SummarySection>

      {/* Insurance */}
      {showInsuranceStep && (
        <SummarySection title="Odvody" step={4} onEdit={onEditStep}>
          <SummaryRow
            label="Socialne odvody"
            value={
              values.paid_social_monthly != null
                ? `${values.paid_social_monthly} EUR/mesiac`
                : "Neuvedene"
            }
          />
          <SummaryRow
            label="Zdravotne odvody"
            value={
              values.paid_health_monthly != null
                ? `${values.paid_health_monthly} EUR/mesiac`
                : "Neuvedene"
            }
          />
        </SummarySection>
      )}
    </div>
  )
}
