"use client"

import { useOrganization } from "@/providers/organization-provider"
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard"

export default function OnboardingPage() {
  const { isLoading } = useOrganization()

  if (isLoading) return null

  return <OnboardingWizard />
}
