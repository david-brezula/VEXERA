# Sprint 4: Member Management & Collaboration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make team collaboration production-ready — invite members via email (Resend), accept invitations, manage roles, link accountants to clients, and add team step to onboarding.

**Architecture:** Resend for transactional email, server actions for all mutations with role validation, invitation token-based acceptance flow, `useCurrentMemberRole()` hook for UI guards.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS), Resend, React Hook Form + Zod, TanStack Query, shadcn/ui

---

## Context for All Tasks

**Codebase location:** `c:/Users/david/Documents/NW/Claude setup/VEXERA`

**Key patterns:**
- Server actions: `"use server"`, use `createClient()` from `@/lib/supabase/server`, `getActiveOrgId()` from `@/lib/data/org`, return `{ error?: string }` or `{ id: string }`
- Client components: `"use client"`, use `useSupabase()`, `useOrganization()`, `useQuery()` from TanStack
- Dialogs: `useState` for open, `useTransition` for async, `toast` from sonner for feedback
- Supabase tables not in generated types require `as any` casts
- Install packages with `npx pnpm add` (pnpm not directly on PATH)
- Run type-check: `cd apps/web && npx pnpm tsc --noEmit`
- Run build: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build`

**Existing schema (already migrated, DO NOT recreate):**
- `organization_members` — id, organization_id, user_id, role (owner/admin/member), created_at
- `invitations` — id, organization_id, invited_by, invited_email, role (accountant/admin/member), token, status (pending/accepted/expired/revoked), expires_at, created_at
- `accountant_clients` — id, accountant_id, organization_id, invitation_id, status, permissions (JSONB), accepted_at, revoked_at, created_at
- `profiles` — id, email, full_name, avatar_url, phone

**Existing types in `packages/types/src/index.ts`:**
```typescript
export type OrganizationRole = 'owner' | 'admin' | 'member'
export type InvitationRole = 'accountant' | 'admin' | 'member'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type AccountantClientStatus = 'pending' | 'active' | 'revoked'
export interface AccountantPermissions {
  view_invoices: boolean; close_invoices: boolean; manage_ledger: boolean;
  view_documents: boolean; upload_documents: boolean;
}
```

**RLS policies already exist** for invitations, organization_members, and accountant_clients — no RLS changes needed.

---

## Phase A: Email Infrastructure + Invitation Server Actions

### Task 1: Install Resend and Create Email Utility

**Files:**
- Create: `apps/web/src/lib/email/send-invitation.ts`
- Create: `apps/web/src/lib/email/invitation-template.tsx`

**Step 1: Install Resend**

```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm add resend
```

**Step 2: Create invitation email template**

Create `apps/web/src/lib/email/invitation-template.tsx`:

```tsx
interface InvitationEmailProps {
  organizationName: string
  inviterName: string
  role: string
  inviteUrl: string
}

export function InvitationEmailHtml({ organizationName, inviterName, role, inviteUrl }: InvitationEmailProps) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #111; margin-bottom: 8px;">You've been invited to ${organizationName}</h2>
  <p style="color: #555; font-size: 16px; line-height: 1.5;">
    ${inviterName} has invited you to join <strong>${organizationName}</strong> as <strong>${role}</strong> on VEXERA.
  </p>
  <a href="${inviteUrl}" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 24px 0;">
    Accept Invitation
  </a>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">
    This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
  </p>
</body>
</html>`
}
```

**Step 3: Create send invitation utility**

Create `apps/web/src/lib/email/send-invitation.ts`:

```typescript
import { Resend } from "resend"
import { InvitationEmailHtml } from "./invitation-template"

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendInvitationParams {
  to: string
  organizationName: string
  inviterName: string
  role: string
  token: string
}

export async function sendInvitationEmail({ to, organizationName, inviterName, role, token }: SendInvitationParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const inviteUrl = `${appUrl}/auth/invite/${token}`

  const { error } = await resend.emails.send({
    from: "VEXERA <noreply@vexera.sk>",
    to,
    subject: `You've been invited to ${organizationName}`,
    html: InvitationEmailHtml({ organizationName, inviterName, role, inviteUrl }),
  })

  if (error) throw new Error(`Failed to send invitation email: ${error.message}`)
}
```

**Step 4: Commit**

```
feat(email): add Resend integration and invitation email template
```

---

### Task 2: Invitation Server Actions

**Files:**
- Create: `apps/web/src/lib/actions/members.ts`

**Step 1: Create member management server actions**

Create `apps/web/src/lib/actions/members.ts`:

```typescript
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
  const { data: existingMember } = await (supabase as any)
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", (await (supabase as any).from("profiles").select("id").eq("email", email).single()).data?.id)
    .maybeSingle()
  if (existingMember) return { error: "User is already a member of this organization" }

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
    // Invitation created but email failed — don't block
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

  // Get invitation details
  const { data: invitation, error: fetchError } = await (supabase as any)
    .from("invitations")
    .select("token, invited_email, role, organization_id")
    .eq("id", invitationId)
    .eq("organization_id", orgId)
    .single()

  if (fetchError || !invitation) return { error: "Invitation not found" }

  // Reset expiry
  await (supabase as any)
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" })
    .eq("id", invitationId)

  // Get org name and inviter name
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

  // Can't change the owner's role
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

  // Can't remove the owner
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

  // Get invitation
  const { data: invitation, error: fetchError } = await (supabase as any)
    .from("invitations")
    .select("id, organization_id, invited_email, role, status, expires_at")
    .eq("token", token)
    .single()

  if (fetchError || !invitation) return { error: "Invitation not found" }

  // Validate
  if (invitation.status !== "pending") return { error: `This invitation has been ${invitation.status}` }
  if (new Date(invitation.expires_at) < new Date()) {
    await (supabase as any).from("invitations").update({ status: "expired" }).eq("id", invitation.id)
    return { error: "This invitation has expired" }
  }

  // Check email matches
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single()

  if (profile?.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
    return { error: `This invitation was sent to ${invitation.invited_email}. Please log in with that account.` }
  }

  // Check not already a member
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

  // Handle accountant invitation separately
  if (invitation.role === "accountant") {
    // Create accountant_clients link instead of org membership
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
    // Create org membership
    const { error: memberError } = await (supabase as any)
      .from("organization_members")
      .insert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError) return { error: memberError.message }
  }

  // Mark invitation accepted
  await (supabase as any)
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  return { organizationId: invitation.organization_id, success: true }
}
```

**Step 2: Commit**

```
feat(members): add invitation and member management server actions
```

---

## Phase B: Member Management UI

### Task 3: Invite Member Dialog

**Files:**
- Create: `apps/web/src/components/members/invite-member-dialog.tsx`

**Step 1: Create the invite dialog component**

```tsx
"use client"

import { useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createInvitationAction } from "@/lib/actions/members"
import { PlusIcon } from "lucide-react"

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      const result = await createInvitationAction(email.trim(), role)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invitation sent to ${email}`)
        setEmail("")
        setRole("member")
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="h-4 w-4 mr-2" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add someone to your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Sending..." : "Send invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```
feat(members): add invite member dialog component
```

---

### Task 4: useCurrentMemberRole Hook

**Files:**
- Create: `apps/web/src/hooks/use-current-member-role.ts`

**Step 1: Create the hook**

```typescript
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
      const { data } = await (supabase as any)
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
```

**Step 2: Commit**

```
feat(members): add useCurrentMemberRole hook for role-based UI
```

---

### Task 5: Rebuild Members Page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/members/page.tsx`

**Step 1: Rewrite the members page with full management UI**

Replace the entire file with a page that:
- Fetches members with profiles join (`organization_members` → `profiles`)
- Fetches pending invitations (`invitations` where status = `pending` and not expired)
- Shows `InviteMemberDialog` button (visible to admin/owner via `useCurrentMemberRole`)
- Members list with: avatar, name, email, role badge, crown icon for owner
- Actions dropdown per member (owner/admin only): Change Role, Remove Member
- Pending invitations section below: email, role, invited by, expires, Revoke/Resend buttons
- Confirmation dialogs for destructive actions (remove member, revoke invitation)
- Uses `useTransition` for action calls, `toast` for feedback
- Calls `updateMemberRoleAction`, `removeMemberAction`, `revokeInvitationAction`, `resendInvitationAction`

Use the existing page's patterns (useQuery, useSupabase, useOrganization, Card components, Skeleton loading).

**Step 2: Commit**

```
feat(members): rebuild settings/members page with invite and manage UI
```

---

## Phase C: Invitation Acceptance Flow

### Task 6: Invitation Acceptance Page

**Files:**
- Modify: `apps/web/src/app/(auth)/invite/[token]/page.tsx`

**Step 1: Replace the stub with full acceptance flow**

The page should:
- Be a server component that fetches invitation details by token (limited: org name, role, status, expires_at)
- Render a client component `InviteAcceptanceClient` with the invitation data
- Client component checks auth state via `useSupabase()`

**Case 1: Not logged in** — show invitation card with org name and role, two buttons:
- "I have an account" → navigate to `/auth/login?redirect=/auth/invite/[token]`
- "Create account" → navigate to `/auth/register?email=[invited_email]&redirect=/auth/invite/[token]`

**Case 2: Logged in** — show "Accept invitation to [org]?" with Accept button
- On accept: call `acceptInvitationAction(token)`
- On success: set active org cookie, redirect to `/dashboard`
- On error: show error message

**Edge cases:**
- Invalid/not found token → "Invitation not found"
- Expired → "This invitation has expired"
- Already accepted → "Already a member" + link to dashboard
- Revoked → "This invitation is no longer valid"
- Email mismatch → show message from server action

**Step 2: Commit**

```
feat(auth): implement invitation acceptance flow
```

---

### Task 7: Login/Register Redirect Support

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/register/page.tsx`

**Step 1: Add redirect query param support to login**

- Read `redirect` from `useSearchParams()`
- After successful login, if `redirect` param exists, navigate there instead of `/dashboard`

**Step 2: Add redirect and email prefill to register**

- Read `redirect` and `email` from `useSearchParams()`
- Pre-fill email field if `email` param exists
- After successful registration, if `redirect` param exists, navigate there instead of `/onboarding`
  - But only if user already has an org (redirect from invite means they're joining an existing org)
  - New users without orgs should still go to onboarding first, then the redirect

**Step 3: Commit**

```
feat(auth): add redirect param support to login and register pages
```

---

## Phase D: Accountant-Client Linking

### Task 8: Accountant Invitation Actions

**Files:**
- Modify: `apps/web/src/lib/actions/members.ts`

**Step 1: Add accountant-specific invitation actions**

Add to `members.ts`:

```typescript
export async function createAccountantInvitationAction(
  email: string,
  targetOrgId: string,
  permissions: AccountantPermissions,
  direction: "accountant_invites_client" | "client_invites_accountant"
) {
  // For "accountant_invites_client": accountant sends invite to client org owner
  //   - Uses accountant's active org as context
  //   - Creates invitation with role "accountant" on TARGET org
  //   - Stores permissions in invitation metadata (add a permissions column or use a separate approach)
  //
  // For "client_invites_accountant": client sends invite to accountant
  //   - Uses client's active org as context
  //   - Creates invitation with role "accountant"
  //   - Stores permissions
  //
  // On acceptance (handled in acceptInvitationAction already):
  //   - Creates accountant_clients row with the accepting user as accountant_id
}

export async function revokeAccountantAccessAction(accountantClientId: string) {
  // Set accountant_clients.status = "revoked", set revoked_at
  // Revalidate paths
}
```

The `acceptInvitationAction` in Task 2 already handles `role === "accountant"` by creating an `accountant_clients` row.

**Step 2: Commit**

```
feat(accountant): add accountant invitation and access revocation actions
```

---

### Task 9: Accountant Client Management UI

**Files:**
- Create: `apps/web/src/components/members/invite-accountant-dialog.tsx`
- Create: `apps/web/src/components/members/add-client-dialog.tsx`

**Step 1: Create invite accountant dialog** (for clients)

- Dialog with email input + permission checkboxes (view_invoices, close_invoices, manage_ledger, view_documents, upload_documents)
- Calls `createAccountantInvitationAction` with direction "client_invites_accountant"
- Shown on Settings > Members page when org type is NOT accounting_firm

**Step 2: Create add client dialog** (for accountants)

- Dialog with client email input + permission checkboxes
- Calls `createAccountantInvitationAction` with direction "accountant_invites_client"
- Shown on accountant dashboard

**Step 3: Add "Your Accountant" section to Members page**

- If org has an active `accountant_clients` link, show the accountant's name/email with "Revoke Access" button
- If no accountant linked, show "Invite Accountant" button (the dialog from Step 1)

**Step 4: Add client management to accountant dashboard**

- Show "Add Client" button with the dialog from Step 2
- Each client card gets "Revoke Access" action

**Step 5: Commit**

```
feat(accountant): add accountant-client linking UI components
```

---

## Phase E: Onboarding Team Step

### Task 10: Add Team Step to Onboarding Wizard

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- Create: `apps/web/src/components/onboarding/team-step.tsx`

**Step 1: Create team step component**

`team-step.tsx`:
- Repeatable rows: email input + role select (admin/member)
- "Add another" button to append a row
- "Skip for now" button that advances to next step without sending invites
- "Send invitations & continue" button that:
  - Calls `createInvitationAction` for each row
  - Shows toast for each sent/failed
  - Advances to next step

**Step 2: Insert into wizard**

- Current steps: Type (0) → Profile (1) → Contact (2) → Documents (3) → Bank (4)
- New steps: Type (0) → Profile (1) → Contact (2) → **Team (3)** → Documents (4) → Bank (5)
- Update step count, labels, and progress bar
- Team step renders `<TeamStep onNext={nextStep} />`

**Step 3: Commit**

```
feat(onboarding): add optional team invitation step to wizard
```

---

## Phase F: Role-Based UI Guards

### Task 11: Apply Role Guards Across UI

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/members/page.tsx` (if not done in Task 5)
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (or wherever org settings live)

**Step 1: Guard member management actions**

In Members page (may already be done from Task 5):
- Use `useCurrentMemberRole()` hook
- Hide "Invite member" button if `!isAdmin`
- Hide actions dropdown if `!isAdmin`
- Show read-only view for regular members

**Step 2: Guard org settings**

- In org settings page, use `useCurrentMemberRole()`
- Disable edit form fields if `!isAdmin`
- Show "You don't have permission to edit organization settings" message for members

**Step 3: Commit**

```
feat(rbac): apply role-based UI guards to settings pages
```

---

## Phase G: Verification

### Task 12: Type-Check and Build

**Step 1: Run type-check**

```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm tsc --noEmit
```

Fix any type errors.

**Step 2: Run build**

```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build
```

Fix any build errors.

**Step 3: Commit fixes if any**

```
fix: resolve type-check and build errors for sprint 4
```

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| A | 1-2 | Resend email + invitation server actions |
| B | 3-5 | Invite dialog, role hook, members page rebuild |
| C | 6-7 | Invitation acceptance page + auth redirects |
| D | 8-9 | Accountant-client linking actions + UI |
| E | 10 | Onboarding team step |
| F | 11 | Role-based UI guards |
| G | 12 | Type-check + build verification |
