"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useSupabase } from "@/providers/supabase-provider"
import { acceptInvitationAction } from "@/lib/actions/members"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface InviteAcceptClientProps {
  token: string
  organizationName: string
  role: string
  invitedEmail: string
}

export function InviteAcceptClient({
  token,
  organizationName,
  role,
  invitedEmail,
}: InviteAcceptClientProps) {
  const router = useRouter()
  const { user, isLoading } = useSupabase()
  const [isAccepting, setIsAccepting] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Loading...</CardTitle>
          <CardDescription>Checking your authentication status</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">You&apos;ve been invited</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join <strong>{organizationName}</strong> as{" "}
            <strong>{role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={() =>
              router.push(`/login?redirect=/invite/${token}`)
            }
          >
            I have an account
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              router.push(
                `/register?email=${encodeURIComponent(invitedEmail)}&redirect=/invite/${token}`
              )
            }
          >
            Create account
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function handleAccept() {
    setIsAccepting(true)
    try {
      const result = await acceptInvitationAction(token)

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      if ("alreadyMember" in result) {
        toast.info("You are already a member of this organization")
      } else {
        toast.success(`You have joined ${organizationName}!`)
      }

      document.cookie = `active_organization_id=${result.organizationId}; path=/; max-age=${60 * 60 * 24 * 365}`
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Accept invitation</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join <strong>{organizationName}</strong> as{" "}
          <strong>{role}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={handleAccept}
          disabled={isAccepting}
        >
          {isAccepting ? "Accepting..." : "Accept invitation"}
        </Button>
      </CardContent>
    </Card>
  )
}
