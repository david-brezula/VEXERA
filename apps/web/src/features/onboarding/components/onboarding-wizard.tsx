"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react"

import type { OrganizationType } from "@vexera/types"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { Form } from "@/shared/components/ui/form"

import { useWizardForm } from "../hooks/use-wizard-form"
import type { WizardFormValues } from "../schemas"
import { StepOrgType } from "./steps/step-org-type"
import { StepBusinessIdentity } from "./steps/step-business-identity"
import { StepBusinessDetails } from "./steps/step-business-details"
import { StepPersonalStatus } from "./steps/step-personal-status"
import { StepInsurance } from "./steps/step-insurance"
import { StepSummary } from "./steps/step-summary"

// Step metadata for progress bar
const STEP_LABELS = [
  "Typ organizacie",
  "Udaje o zivnosti",
  "Detaily podnikania",
  "Osobny status",
  "Poistenie",
  "Zhrnutie",
]

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({
  currentStep,
  totalSteps,
  showInsuranceStep,
}: {
  currentStep: number
  totalSteps: number
  showInsuranceStep: boolean
}) {
  const labels = showInsuranceStep
    ? STEP_LABELS
    : STEP_LABELS.filter((_, i) => i !== 4)

  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Krok {currentStep + 1} z {totalSteps} —{" "}
          <span className="text-foreground font-semibold">
            {labels[currentStep]}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round((currentStep / totalSteps) * 100)}% hotovo
        </p>
      </div>
      <div className="flex gap-1.5">
        {labels.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              currentStep > i
                ? "bg-primary"
                : currentStep === i
                  ? "bg-primary/60"
                  : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Step title / description map ────────────────────────────────────────────

function getStepInfo(
  step: number,
  showInsurance: boolean
): { title: string; description: string } {
  const map: Record<number, { title: string; description: string }> = {
    0: {
      title: "Vitajte vo Vexere",
      description:
        "Vyberte typ vasej organizacie, aby sme mohli prisposobit nastavenie.",
    },
    1: {
      title: "Udaje o zivnosti",
      description: "Zadajte zakladne informacie o vasej zivnosti.",
    },
    2: {
      title: "Detaily podnikania",
      description: "Nastavte danovy rezim a datum zalozenia zivnosti.",
    },
    3: {
      title: "Osobny status",
      description:
        "Tieto informacie potrebujeme pre presne vypocty odvodov a dani.",
    },
  }

  if (showInsurance) {
    map[4] = {
      title: "Poistenie",
      description: "Zadajte aktualnu vysku vasich mesacnych odvodov.",
    }
    map[5] = {
      title: "Zhrnutie",
      description: "Skontrolujte zadane udaje pred dokoncenim nastavenia.",
    }
  } else {
    map[4] = {
      title: "Zhrnutie",
      description: "Skontrolujte zadane udaje pred dokoncenim nastavenia.",
    }
  }

  return map[step] ?? { title: "", description: "" }
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orgCreated, setOrgCreated] = useState(!!activeOrg)

  const {
    form,
    currentStep,
    totalSteps,
    isFirstYear,
    showInsuranceStep,
    goNext,
    goBack,
    goToStep,
    clearSavedState,
  } = useWizardForm()

  // Step 0: Handle org type selection
  async function handleTypeSelect(type: OrganizationType) {
    if (type !== "freelancer") return // Only freelancer supported now

    try {
      if (activeOrg) {
        // Org already exists, just update type
        const { error: updateError } = await supabase
          .from("organizations")
          .update({ organization_type: type })
          .eq("id", activeOrg.id)
        if (updateError) throw updateError

        // Ensure freelancer profile exists
        const { error: upsertError } = await supabase
          .from("freelancer_profiles")
          .upsert(
            {
              organization_id: activeOrg.id,
              tax_regime: "pausalne_vydavky",
              registered_dph: false,
              is_first_year: false,
              has_social_insurance: false,
              is_disabled: false,
              is_student: false,
              is_pensioner: false,
              has_other_employment: false,
            },
            { onConflict: "organization_id" }
          )
        if (upsertError) throw upsertError

        setOrgCreated(true)
        goNext()
      } else if (user) {
        // Create new org + member + freelancer profile
        // First ensure profile exists
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email ?? "",
              full_name: user.user_metadata?.full_name ?? null,
              avatar_url: user.user_metadata?.avatar_url ?? null,
            },
            { onConflict: "id" }
          )
        if (profileError) throw profileError

        const orgId = crypto.randomUUID()

        const { error: orgError } = await supabase
          .from("organizations")
          .insert({
            id: orgId,
            name: "Moja zivnost",
            organization_type: "freelancer",
          })
        if (orgError) throw orgError

        const { error: memberError } = await supabase
          .from("organization_members")
          .insert({
            organization_id: orgId,
            user_id: user.id,
            role: "owner",
          })
        if (memberError) throw memberError

        const { error: freelancerError } = await supabase
          .from("freelancer_profiles")
          .insert({
            organization_id: orgId,
            tax_regime: "pausalne_vydavky",
            registered_dph: false,
            is_first_year: false,
            has_social_insurance: false,
            is_disabled: false,
            is_student: false,
            is_pensioner: false,
            has_other_employment: false,
          })
        if (freelancerError) throw freelancerError

        // Set active org cookie
        document.cookie = `active_organization_id=${encodeURIComponent(orgId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

        setOrgCreated(true)
        goNext()
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa vytvorit organizaciu"
      )
    }
  }

  // Final submit
  async function handleSubmit(values: WizardFormValues) {
    const orgId = activeOrg?.id
    if (!orgId) return
    setIsSubmitting(true)

    try {
      // Determine is_first_year from founding_date
      const foundingDate = values.founding_date
        ? new Date(values.founding_date)
        : null
      const now = new Date()
      const computedIsFirstYear = foundingDate
        ? (now.getFullYear() - foundingDate.getFullYear()) * 12 +
            (now.getMonth() - foundingDate.getMonth()) <
          12
        : false

      // Update organization
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: values.name,
          ico: values.ico || null,
          dic: values.dic || null,
          ic_dph: values.ic_dph || null,
          address_street: values.address_street || null,
          address_city: values.address_city || null,
          address_zip: values.address_zip || null,
        })
        .eq("id", orgId)
      if (orgError) throw orgError

      // Update freelancer profile
      const { error: freelancerError } = await supabase
        .from("freelancer_profiles")
        .update({
          ico: values.ico || null,
          tax_regime: values.tax_regime,
          registered_dph: values.registered_dph,
          is_first_year: computedIsFirstYear,
          founding_date: values.founding_date || null,
          has_social_insurance: !!values.paid_social_monthly,
          paid_social_monthly: values.paid_social_monthly ?? null,
          paid_health_monthly: values.paid_health_monthly ?? null,
          is_disabled: values.is_disabled,
          is_student: values.is_student,
          is_pensioner: values.is_pensioner,
          has_other_employment: values.has_other_employment,
        })
        .eq("organization_id", orgId)
      if (freelancerError) throw freelancerError

      localStorage.setItem("onboarding_complete", "true")
      clearSavedState()
      toast.success("Nastavenie dokoncene!")
      router.push("/dashboard")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa ulozit udaje"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step title/description
  const stepInfo = getStepInfo(currentStep, showInsuranceStep)

  // Determine which is the summary step index
  const summaryStep = showInsuranceStep ? 5 : 4

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        showInsuranceStep={showInsuranceStep}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{stepInfo.title}</CardTitle>
          <CardDescription>{stepInfo.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div
              key={currentStep}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {currentStep === 0 && (
                <StepOrgType onSelect={handleTypeSelect} />
              )}
              {currentStep === 1 && <StepBusinessIdentity form={form} />}
              {currentStep === 2 && <StepBusinessDetails form={form} />}
              {currentStep === 3 && <StepPersonalStatus form={form} />}
              {currentStep === 4 && showInsuranceStep && (
                <StepInsurance form={form} />
              )}
              {currentStep === summaryStep && (
                <StepSummary
                  form={form}
                  onEditStep={goToStep}
                  isFirstYear={isFirstYear}
                  showInsuranceStep={showInsuranceStep}
                />
              )}
            </div>

            {/* Navigation buttons -- NOT shown on step 0 (type picker) */}
            {currentStep > 0 && (
              <div className="flex justify-between pt-6">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Spat
                </Button>

                {currentStep === summaryStep ? (
                  <Button
                    type="button"
                    onClick={form.handleSubmit(handleSubmit)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                        Ukladam...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Zacat
                        pouzivat Vexeru
                      </>
                    )}
                  </Button>
                ) : (
                  <Button type="button" onClick={goNext}>
                    Pokracovat <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
