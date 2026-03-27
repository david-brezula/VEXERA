"use client"

import { useQuery } from "@tanstack/react-query"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"

export function useCurrentMemberRole() {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()

  const { data: role, isLoading } = useQuery({
    queryKey: ["member-role", activeOrg?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", activeOrg!.id)
        .eq("user_id", user!.id)
        .single()
      return (data?.role as string) ?? null
    },
    enabled: !!activeOrg?.id && !!user?.id,
  })

  const isOwner = role === "owner"
  const isAdmin = role === "admin" || role === "owner"

  return { role, isOwner, isAdmin, isLoading }
}
