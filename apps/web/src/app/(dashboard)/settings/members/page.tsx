"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { useCurrentMemberRole } from "@/shared/hooks/use-current-member-role"
import { InviteMemberDialog } from "@/features/settings/components/members/invite-member-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  updateMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
  resendInvitationAction,
  revokeAccountantAccessAction,
} from "@/features/settings/actions-members"
import { InviteAccountantDialog } from "@/features/settings/components/members/invite-accountant-dialog"
import { CrownIcon, MoreHorizontalIcon, ShieldCheckIcon } from "lucide-react"

type MemberProfile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

type MemberRow = {
  id: string
  role: string
  created_at: string
  profiles: MemberProfile | null
}

type InvitationRow = {
  id: string
  invited_email: string
  role: string
  status: string
  expires_at: string
  created_at: string
  invited_by_profile: { full_name: string | null } | null
}

type AccountantClientRow = {
  id: string
  accountant_id: string
  status: string
  accepted_at: string | null
  profiles: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  return email.charAt(0).toUpperCase()
}

export default function MembersPage() {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const { isAdmin, isLoading: roleLoading } = useCurrentMemberRole()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  const { data: members, isLoading: membersLoading } = useQuery({
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
          profiles:user_id(id, email, full_name, avatar_url)
        `
        )
        .eq("organization_id", activeOrg.id)

      if (error) throw error
      return (data ?? []) as MemberRow[]
    },
    enabled: !!activeOrg,
  })

  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ["invitations", activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg) return []
      const { data, error } = await supabase
        .from("invitations")
        .select(
          `
          id,
          invited_email,
          role,
          status,
          expires_at,
          created_at,
          invited_by_profile:invited_by(full_name)
        `
        )
        .eq("organization_id", activeOrg.id)
        .eq("status", "pending")

      if (error) throw error
      return (data ?? []) as InvitationRow[]
    },
    enabled: !!activeOrg && isAdmin,
  })

  const isAccountingFirm = activeOrg?.organization_type === "accounting_firm"

  const { data: accountantClients, isLoading: accountantLoading } = useQuery({
    queryKey: ["accountant-clients", activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg) return []
      const { data, error } = await supabase
        .from("accountant_clients")
        .select(
          `
          id,
          accountant_id,
          status,
          accepted_at,
          profiles:accountant_id(full_name, email, avatar_url)
        `
        )
        .eq("organization_id", activeOrg.id)
        .eq("status", "active")

      if (error) throw error
      return (data ?? []) as AccountantClientRow[]
    },
    enabled: !!activeOrg && !isAccountingFirm,
  })

  function handleRevokeAccountant(accountantClientId: string, name: string) {
    if (!window.confirm(`Naozaj chcete zrušiť prístup pre ${name}?`)) return
    startTransition(async () => {
      const result = await revokeAccountantAccessAction(accountantClientId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Prístup účtovníka zrušený")
        queryClient.invalidateQueries({ queryKey: ["accountant-clients", activeOrg?.id] })
      }
    })
  }

  function handleChangeRole(memberId: string, newRole: "admin" | "member") {
    startTransition(async () => {
      const result = await updateMemberRoleAction(memberId, newRole)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Rola zmenená na ${newRole}`)
        queryClient.invalidateQueries({ queryKey: ["members", activeOrg?.id] })
        queryClient.invalidateQueries({ queryKey: ["member-role"] })
      }
    })
  }

  function handleRemoveMember(memberId: string, name: string) {
    if (!window.confirm(`Naozaj chcete odstrániť ${name}?`)) return
    startTransition(async () => {
      const result = await removeMemberAction(memberId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Člen odstránený")
        queryClient.invalidateQueries({ queryKey: ["members", activeOrg?.id] })
      }
    })
  }

  function handleRevokeInvitation(invitationId: string) {
    startTransition(async () => {
      const result = await revokeInvitationAction(invitationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Pozvánka zrušená")
        queryClient.invalidateQueries({
          queryKey: ["invitations", activeOrg?.id],
        })
      }
    })
  }

  function handleResendInvitation(invitationId: string) {
    startTransition(async () => {
      const result = await resendInvitationAction(invitationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Pozvánka opätovne odoslaná")
        queryClient.invalidateQueries({
          queryKey: ["invitations", activeOrg?.id],
        })
      }
    })
  }

  if (!activeOrg) {
    return <p className="text-muted-foreground">Nie je vybraná organizácia.</p>
  }

  const isLoading = membersLoading || roleLoading

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Členovia</h1>
          <p className="text-muted-foreground">
            Spravujte prístupy k {activeOrg.name}
          </p>
        </div>
        {isAdmin && <InviteMemberDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Členovia tímu</CardTitle>
          <CardDescription>
            Ľudia s prístupom k tejto organizácii.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {members?.map((member) => {
                const profile = member.profiles
                const name = profile?.full_name ?? "Bez mena"
                const email = profile?.email ?? ""
                const isOwnerMember = member.role === "owner"

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {profile?.avatar_url && (
                          <AvatarImage src={profile.avatar_url} alt={name} />
                        )}
                        <AvatarFallback>
                          {getInitials(profile?.full_name, email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium flex items-center gap-1.5">
                          {name}
                          {isOwnerMember && (
                            <CrownIcon className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          isOwnerMember ? "default" : "secondary"
                        }
                      >
                        {member.role}
                      </Badge>
                      {isAdmin && !isOwnerMember && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={isPending}
                            >
                              <MoreHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Akcie</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleChangeRole(
                                  member.id,
                                  member.role === "admin" ? "member" : "admin"
                                )
                              }
                            >
                              {member.role === "admin"
                                ? "Zmeniť na člena"
                                : "Zmeniť na administrátora"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                handleRemoveMember(member.id, name)
                              }
                            >
                              Odstrániť člena
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
              {members?.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Žiadni členovia.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (invitations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Čakajúce pozvánky</CardTitle>
            <CardDescription>
              Pozvánky, ktoré ešte neboli prijaté.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {invitations?.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {invitation.invited_email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Invited by{" "}
                        {invitation.invited_by_profile?.full_name ??
                          "a team member"}
                        {" \u00b7 "}
                        Expires{" "}
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{invitation.role}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleResendInvitation(invitation.id)}
                      >
                        Poslať znova
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        className="text-destructive"
                        onClick={() => handleRevokeInvitation(invitation.id)}
                      >
                        Zrušiť
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAccountingFirm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5" />
                  Váš účtovník
                </CardTitle>
                <CardDescription>
                  Externý účtovník s prístupom k vašej organizácii.
                </CardDescription>
              </div>
              {isAdmin && (!accountantClients || accountantClients.length === 0) && (
                <InviteAccountantDialog />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {accountantLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : accountantClients && accountantClients.length > 0 ? (
              <div className="space-y-3">
                {accountantClients.map((ac) => {
                  const profile = ac.profiles
                  const name = profile?.full_name ?? "Bez mena"
                  const email = profile?.email ?? ""
                  return (
                    <div
                      key={ac.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {profile?.avatar_url && (
                            <AvatarImage src={profile.avatar_url} alt={name} />
                          )}
                          <AvatarFallback>
                            {getInitials(profile?.full_name, email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">{email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Účtovník</Badge>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            className="text-destructive"
                            onClick={() => handleRevokeAccountant(ac.id, name)}
                          >
                            Zrušiť prístup
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Žiadny účtovník nie je prepojený. Pozvite účtovníka, aby mal prístup k vašim finančným dátam.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
