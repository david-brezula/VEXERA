import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { InviteAcceptClient } from "@/features/settings/components/members/invite-accept-client"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, invited_email, role, status, expires_at, organization_id")
    .eq("token", token)
    .single()

  // Fetch organization name separately (join not available in strict types)
  let orgName = "Unknown organization"
  if (invitation) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single()
    if (org) orgName = org.name
  }

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

  const organizationName = orgName

  return (
    <InviteAcceptClient
      token={token}
      organizationName={organizationName}
      role={invitation.role}
      invitedEmail={invitation.invited_email}
    />
  )
}
