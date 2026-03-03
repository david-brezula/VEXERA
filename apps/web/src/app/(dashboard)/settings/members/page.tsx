"use client"

import { useQuery } from "@tanstack/react-query"

import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function MembersPage() {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg) return []
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          id,
          role,
          created_at,
          profile:profiles (
            id,
            email,
            full_name,
            avatar_url
          )
        `
        )
        .eq("organization_id", activeOrg.id)

      if (error) throw error
      return data ?? []
    },
    enabled: !!activeOrg,
  })

  if (!activeOrg) {
    return <p className="text-muted-foreground">No organization selected.</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          Manage who has access to {activeOrg.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            People who have access to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {(member.profile as { full_name: string | null })?.full_name ?? "Unnamed"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(member.profile as { email: string })?.email}
                    </p>
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                </div>
              ))}
              {members?.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No members found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
