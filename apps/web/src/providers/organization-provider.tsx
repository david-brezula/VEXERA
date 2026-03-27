"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSupabase } from "./supabase-provider"

type Organization = {
  id: string
  name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  address_street: string | null
  address_city: string | null
  address_zip: string | null
  bank_iban: string | null
  email: string | null
  phone: string | null
  subscription_plan: string
  organization_type: string
}

type OrganizationContextValue = {
  activeOrg: Organization | null
  userOrgs: Organization[]
  isLoading: boolean
  isSwitching: boolean
  switchOrg: (orgId: string) => void
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined
)

const ACTIVE_ORG_COOKIE = "active_organization_id"

function getActiveOrgIdFromCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_ORG_COOKIE}=([^;]*)`)
  )
  return match ? decodeURIComponent(match[1] ?? "") : null
}

function setActiveOrgCookie(orgId: string) {
  document.cookie = `${ACTIVE_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

function clearActiveOrgCookie() {
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    getActiveOrgIdFromCookie
  )
  const [isSwitching, setIsSwitching] = useState(false)

  const { data: userOrgs = [], isLoading } = useQuery({
    queryKey: ["organizations", user?.id],
    queryFn: async () => {
      if (!user) return []

      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          organization:organizations (
            id,
            name,
            ico,
            dic,
            ic_dph,
            address_street,
            address_city,
            address_zip,
            bank_iban,
            email,
            phone,
            subscription_plan,
            organization_type
          )
        `
        )
        .eq("user_id", user.id)

      if (error) throw error

      return (data ?? [])
        .map((row) => row.organization)
        .filter((org): org is Organization => org !== null)
    },
    enabled: !!user,
  })

  // Auto-select first org if none selected
  useEffect(() => {
    if (!isLoading && userOrgs.length > 0 && !activeOrgId) {
      const firstOrg = userOrgs[0]
      if (firstOrg) {
        setActiveOrgId(firstOrg.id)
        setActiveOrgCookie(firstOrg.id)
      }
    }
  }, [isLoading, userOrgs, activeOrgId])

  const switchOrg = useCallback(
    async (orgId: string) => {
      setIsSwitching(true)
      try {
        queryClient.removeQueries()
        setActiveOrgId(orgId)
        setActiveOrgCookie(orgId)
        await queryClient.invalidateQueries()
        router.refresh()
      } finally {
        setIsSwitching(false)
      }
    },
    [queryClient, router]
  )

  // Detect when activeOrgId is set but no longer exists in userOrgs (e.g. user removed from org)
  useEffect(() => {
    if (
      !isLoading &&
      userOrgs.length > 0 &&
      activeOrgId &&
      !userOrgs.find((org) => org.id === activeOrgId)
    ) {
      toast.error("You no longer have access to the selected organization")
      clearActiveOrgCookie()
      const firstOrg = userOrgs[0]
      if (firstOrg) {
        setActiveOrgId(firstOrg.id)
        setActiveOrgCookie(firstOrg.id)
      } else {
        setActiveOrgId(null)
      }
    }
  }, [isLoading, userOrgs, activeOrgId])

  const activeOrg =
    userOrgs.find((org) => org.id === activeOrgId) ?? userOrgs[0] ?? null

  return (
    <OrganizationContext.Provider
      value={{ activeOrg, userOrgs, isLoading, isSwitching, switchOrg }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used inside OrganizationProvider"
    )
  }
  return context
}
