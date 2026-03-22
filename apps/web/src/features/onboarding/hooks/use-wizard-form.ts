"use client"

import { useState, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { wizardSchema, stepSchemas, type WizardFormValues } from "../schemas"

const STORAGE_KEY = "vexera_onboarding_wizard"

// Wizard step indices (after org type selection):
// 0 = org type (handled outside form)
// 1 = business identity (step1Schema)
// 2 = business details (step2Schema)
// 3 = personal status (step3Schema)
// 4 = insurance (step4Schema) — conditional
// 5 = summary (no schema validation)

export function useWizardForm() {
  const [currentStep, setCurrentStep] = useState(0)

  // Restore saved state from localStorage
  const savedData =
    typeof window !== "undefined"
      ? (() => {
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            return raw ? JSON.parse(raw) : null
          } catch {
            return null
          }
        })()
      : null

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: savedData?.values ?? {
      name: "",
      ico: "",
      dic: "",
      ic_dph: "",
      address_street: "",
      address_city: "",
      address_zip: "",
      founding_date: "",
      tax_regime: "pausalne_vydavky",
      registered_dph: false,
      is_student: false,
      is_disabled: false,
      is_pensioner: false,
      has_other_employment: false,
      paid_social_monthly: undefined,
      paid_health_monthly: undefined,
    },
  })

  // Save form state to localStorage on value changes
  useEffect(() => {
    const subscription = form.watch((values) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ values, step: currentStep })
        )
      } catch {
        // Ignore storage errors
      }
    })
    return () => subscription.unsubscribe()
  }, [form, currentStep])

  // Restore step from localStorage
  useEffect(() => {
    if (savedData?.step) {
      setCurrentStep(savedData.step)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute derived values
  const foundingDate = form.watch("founding_date")
  const isPensioner = form.watch("is_pensioner")

  const isFirstYear = (() => {
    if (!foundingDate) return false
    const founded = new Date(foundingDate)
    const now = new Date()
    const monthsDiff =
      (now.getFullYear() - founded.getFullYear()) * 12 +
      (now.getMonth() - founded.getMonth())
    return monthsDiff < 12
  })()

  // Insurance step is shown only when NOT first year AND NOT pensioner
  const showInsuranceStep = !isFirstYear && !isPensioner

  // Total steps: type(0), identity(1), details(2), status(3), [insurance(4)], summary
  const totalSteps = showInsuranceStep ? 6 : 5

  // Map visual step to schema index for validation
  const getSchemaForStep = useCallback(
    (step: number) => {
      if (step === 0) return null // org type, no form validation
      if (step === 1) return stepSchemas[0]
      if (step === 2) return stepSchemas[1]
      if (step === 3) return stepSchemas[2]
      if (step === 4 && showInsuranceStep) return stepSchemas[3]
      return null // summary
    },
    [showInsuranceStep]
  )

  const goNext = useCallback(async () => {
    const schema = getSchemaForStep(currentStep)
    if (schema) {
      // Validate only the fields for the current step
      const fields = Object.keys(
        schema.shape
      ) as (keyof WizardFormValues)[]
      const isValid = await form.trigger(fields)
      if (!isValid) return false
    }
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))
    return true
  }, [currentStep, form, getSchemaForStep, totalSteps])

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }, [])

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step)
  }, [])

  const clearSavedState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }, [])

  return {
    form,
    currentStep,
    totalSteps,
    isFirstYear,
    showInsuranceStep,
    goNext,
    goBack,
    goToStep,
    clearSavedState,
  }
}
