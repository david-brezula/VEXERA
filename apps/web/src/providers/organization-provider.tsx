"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSupabase } from "./supabase-provider"

type Organization = {
  id: string
  name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  subscription_plan: string
  organization_type: string
}

type OrganizationContextValue = {
  activeOrg: Organization | null
  userOrgs: Organization[]
  isLoading: boolean
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
    (orgId: string) => {
      setActiveOrgId(orgId)
      setActiveOrgCookie(orgId)
      queryClient.invalidateQueries()
      router.refresh()
    },
    [queryClient]
  )

  const activeOrg =
    userOrgs.find((org) => org.id === activeOrgId) ?? userOrgs[0] ?? null

  return (
    <OrganizationContext.Provider
      value={{ activeOrg, userOrgs, isLoading, switchOrg }}
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
