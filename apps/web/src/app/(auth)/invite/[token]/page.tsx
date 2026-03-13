import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InviteAcceptClient } from "@/components/members/invite-accept-client"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invitation, error } = await (supabase as any)
    .from("invitations")
    .select("id, invited_email, role, status, expires_at, organizations!organization_id(name)")
    .eq("token", token)
    .single()

  if (error || !invitation) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invitation not found</CardTitle>
          <CardDescription>
            This invitation link is invalid or does not exist.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isExpired = new Date(invitation.expires_at) < new Date()

  if (isExpired || invitation.status === "expired") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invitation expired</CardTitle>
          <CardDescription>
            This invitation has expired. Please ask the organization administrator to send a new invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (invitation.status === "revoked") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invitation revoked</CardTitle>
          <CardDescription>
            This invitation is no longer valid. It has been revoked by the organization administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (invitation.status === "accepted") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Already accepted</CardTitle>
          <CardDescription>
            This invitation has already been accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const organizationName = invitation.organizations?.name ?? "Unknown organization"

  return (
    <InviteAcceptClient
      token={token}
      organizationName={organizationName}
      role={invitation.role}
      invitedEmail={invitation.invited_email}
    />
  )
}
