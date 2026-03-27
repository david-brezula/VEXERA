"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { wizardSchema, stepSchemas, type WizardFormValues } from "../schemas"

const STORAGE_KEY = "vexera_onboarding_wizard"

const DEFAULT_VALUES: WizardFormValues = {
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
}

function loadSavedData(): { values: WizardFormValues; step: number } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useWizardForm() {
  const savedData = useRef(loadSavedData())
  const [currentStep, setCurrentStep] = useState(savedData.current?.step ?? 0)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: savedData.current?.values ?? DEFAULT_VALUES,
  })

  // Debounced save to localStorage (every 500ms, not on every keystroke)
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ values, step: currentStep })
          )
        } catch {}
      }, 500)
    })
    return () => {
      subscription.unsubscribe()
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [form, currentStep])

  // Compute derived values — only watch the two fields we need
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

  const showInsuranceStep = !isFirstYear && !isPensioner
  const totalSteps = showInsuranceStep ? 6 : 5

  const getSchemaForStep = useCallback(
    (step: number) => {
      if (step === 0) return null
      if (step === 1) return stepSchemas[0]
      if (step === 2) return stepSchemas[1]
      if (step === 3) return stepSchemas[2]
      if (step === 4 && showInsuranceStep) return stepSchemas[3]
      return null
    },
    [showInsuranceStep]
  )

  const goNext = useCallback(async () => {
    const schema = getSchemaForStep(currentStep)
    if (schema) {
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
    } catch {}
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
