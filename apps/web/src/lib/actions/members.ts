"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { sendInvitationEmail } from "@/lib/email/send-invitation"

async function getCurrentMemberRole(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single()
  return data?.role as string | null
}

export async function createInvitationAction(email: string, role: "admin" | "member") {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check caller's role
  const callerRole = await getCurrentMemberRole(supabase, orgId, user.id)
  if (!callerRole || callerRole === "member") return { error: "Insufficient permissions" }
  if (role === "admin" && callerRole !== "owner") return { error: "Only owners can invite admins" }

  // Check if already a member
  const { data: existingProfile } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existingProfile) {
    const { data: existingMember } = await (supabase as any)
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", existingProfile.id)
      .maybeSingle()
    if (existingMember) return { error: "User is already a member of this organization" }
  }

  // Check for pending invitation
  const { data: existingInvite } = await (supabase as any)
    .from("invitations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle()
  if (existingInvite) return { error: "An invitation is already pending for this email" }

  // Get org name and inviter name
  const [{ data: org }, { data: profile }] = await Promise.all([
    (supabase as any).from("organizations").select("name").eq("id", orgId).single(),
    (supabase as any).from("profiles").select("full_name").eq("id", user.id).single(),
  ])

  // Create invitation
  const { data: invitation, error } = await (supabase as any)
    .from("invitations")
    .insert({
      organization_id: orgId,
      invited_by: user.id,
      invited_email: email,
      role,
      status: "pending",
    })
    .select("token")
    .single()

  if (error) return { error: error.message }

  // Send email
  try {
    await sendInvitationEmail({
      to: email,
      organizationName: org?.name || "Unknown",
      inviterName: profile?.full_name || "A team member",
      role,
      token: invitation.token,
    })
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError)
  }

  revalidatePath("/settings/members")
  return { success: true }
}

export async function revokeInvitationAction(invitationId: string) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const callerRole = await getCurrentMemberRole(supabase, orgId, user.id)
  if (!callerRole || callerRole === "member") return { error: "Insufficient permissions" }

  const { error } = await (supabase as any)
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("organization_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings/members")
  return { success: true }
}

export async function resendInvitationAction(invitationId: string) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const callerRole = await getCurrentMemberRole(supabase, orgId, user.id)
  if (!callerRole || callerRole === "member") return { error: "Insufficient permissions" }

  const { data: invitation, error: fetchError } = await (supabase as any)
    .from("invitations")
    .select("token, invited_email, role, organization_id")
    .eq("id", invitationId)
    .eq("organization_id", orgId)
    .single()

  if (fetchError || !invitation) return { error: "Invitation not found" }

  await (supabase as any)
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" })
    .eq("id", invitationId)

  const [{ data: org }, { data: profile }] = await Promise.all([
    (supabase as any).from("organizations").select("name").eq("id", orgId).single(),
    (supabase as any).from("profiles").select("full_name").eq("id", user.id).single(),
  ])

  try {
    await sendInvitationEmail({
      to: invitation.invited_email,
      organizationName: org?.name || "Unknown",
      inviterName: profile?.full_name || "A team member",
      role: invitation.role,
      token: invitation.token,
    })
  } catch (emailError) {
    console.error("Failed to resend invitation email:", emailError)
    return { error: "Failed to send email" }
  }

  revalidatePath("/settings/members")
  return { success: true }
}

export async function updateMemberRoleAction(memberId: string, newRole: "admin" | "member") {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const callerRole = await getCurrentMemberRole(supabase, orgId, user.id)
  if (callerRole !== "owner") return { error: "Only the owner can change roles" }

  const { data: targetMember } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("id", memberId)
    .eq("organization_id", orgId)
    .single()

  if (!targetMember) return { error: "Member not found" }
  if (targetMember.role === "owner") return { error: "Cannot change the owner's role" }

  const { error } = await (supabase as any)
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("organization_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings/members")
  return { success: true }
}

export async function removeMemberAction(memberId: string) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const callerRole = await getCurrentMemberRole(supabase, orgId, user.id)
  if (!callerRole || callerRole === "member") return { error: "Insufficient permissions" }

  const { data: targetMember } = await (supabase as any)
    .from("organization_members")
    .select("role, user_id")
    .eq("id", memberId)
    .eq("organization_id", orgId)
    .single()

  if (!targetMember) return { error: "Member not found" }
  if (targetMember.role === "owner") return { error: "Cannot remove the owner" }
  if (targetMember.user_id === user.id) return { error: "Cannot remove yourself" }

  const { error } = await (supabase as any)
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings/members")
  return { success: true }
}

export async function acceptInvitationAction(token: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: invitation, error: fetchError } = await (supabase as any)
    .from("invitations")
    .select("id, organization_id, invited_email, role, status, expires_at")
    .eq("token", token)
    .single()

  if (fetchError || !invitation) return { error: "Invitation not found" }

  if (invitation.status !== "pending") return { error: `This invitation has been ${invitation.status}` }
  if (new Date(invitation.expires_at) < new Date()) {
    await (supabase as any).from("invitations").update({ status: "expired" }).eq("id", invitation.id)
    return { error: "This invitation has expired" }
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single()

  if (profile?.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
    return { error: `This invitation was sent to ${invitation.invited_email}. Please log in with that account.` }
  }

  const { data: existingMember } = await (supabase as any)
    .from("organization_members")
    .select("id")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingMember) {
    await (supabase as any).from("invitations").update({ status: "accepted" }).eq("id", invitation.id)
    return { organizationId: invitation.organization_id, alreadyMember: true }
  }

  if (invitation.role === "accountant") {
    const { error: linkError } = await (supabase as any)
      .from("accountant_clients")
      .insert({
        accountant_id: user.id,
        organization_id: invitation.organization_id,
        invitation_id: invitation.id,
        status: "active",
        accepted_at: new Date().toISOString(),
      })

    if (linkError) return { error: linkError.message }
  } else {
    const { error: memberError } = await (supabase as any)
      .from("organization_members")
      .insert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError) return { error: memberError.message }
  }

  await (supabase as any)
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  return { organizationId: invitation.organization_id, success: true }
}
