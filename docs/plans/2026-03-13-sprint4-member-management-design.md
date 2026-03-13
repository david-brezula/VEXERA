# Sprint 4: Member Management & Collaboration — Design

## Decisions

- **Roles:** Keep current 3 — `owner`, `admin`, `member`
- **Invitation delivery:** Branded email via Resend
- **Accountant-client linking:** Both directions (accountant invites client OR client invites accountant)
- **Onboarding team step:** Optional Step 3 with "Skip for now" button

---

## 1. Invitation System

### Flow
1. Owner/Admin clicks "Invite Member" on Settings > Members
2. Enters email + selects role (`admin` or `member`)
3. Server action creates `invitations` row with random token, status `pending`, expires in 7 days
4. Resend sends branded email with link: `/auth/invite/[token]`
5. Recipient clicks link — if not registered, redirected to register with email pre-filled — after auth, auto-accepts invite
6. On acceptance: creates `organization_members` row, updates invitation status to `accepted`

### Resend Integration
- Package: `resend` in `apps/web`
- Utility: `lib/email/send-invitation.ts`
- React email template for branded invitation
- API key: `RESEND_API_KEY` env var

### Invitation Management
- Pending invitations list with "Revoke" button
- Expired invitations auto-hidden or grayed out
- Resend invite button for pending invitations

### Guard Rails
- Can't invite someone already in the org
- Can't invite to a role higher than your own
- Owner role can't be assigned via invitation

---

## 2. Member Management UI

### Settings > Members Page (replace read-only list)

**Members list:**
- Avatar, name, email, role badge, joined date
- Actions dropdown per member (owner/admin only):
  - Change role: admin <-> member (can't change owner)
  - Remove member: confirmation dialog, deletes `organization_members` row
- Owner has crown icon, can't be removed or demoted

**Pending invitations section (below members):**
- Email, invited role, invited by, expires date
- Actions: Revoke, Resend

### Server Actions
- `updateMemberRoleAction(memberId, newRole)` — owner/admin only
- `removeMemberAction(memberId)` — owner/admin only, can't remove self if owner
- `revokeInvitationAction(invitationId)` — sets status to `revoked`
- `resendInvitationAction(invitationId)` — resets expiry, sends email again

---

## 3. Invite Acceptance Flow

### `/auth/invite/[token]` Page

**Case 1: User is logged in**
- Fetch invitation by token, validate (not expired, not revoked)
- Email matches logged-in user: show "Accept invitation to [org name]?" with Accept button
- Email doesn't match: show "This invitation was sent to [email]. Please log in with that account."
- On accept: create `organization_members` row, update invitation status, redirect to dashboard with new org active

**Case 2: User is not logged in**
- Fetch invitation by token (public query, limited fields)
- Show "You've been invited to [org name]" with:
  - "I have an account" → `/auth/login?redirect=/auth/invite/[token]`
  - "Create account" → `/auth/register?email=[invited_email]&redirect=/auth/invite/[token]`
- After auth, redirect back → Case 1 takes over

**Edge Cases:**
- Expired token: "This invitation has expired. Ask the admin to send a new one."
- Already accepted: "You're already a member." + link to dashboard
- Revoked: "This invitation is no longer valid."

---

## 4. Accountant-Client Linking

### Two-Directional Flow

**Accountant invites client:**
- "Add Client" button on accountant dashboard
- Enter client org owner's email + select permissions (checkboxes from `AccountantPermissions`)
- Creates invitation with role `accountant` + permissions in metadata
- Client accepts → creates `accountant_clients` row with status `active`

**Client invites accountant:**
- "Invite Accountant" button in Settings > Members
- Enter accountant's email + select permissions to grant
- Creates invitation with role `accountant`
- Accountant accepts → creates `accountant_clients` row

### Management UI
- Accountant dashboard: client list with status, "Revoke Access" button
- Client Settings: "Your Accountant" section with linked accountant, "Revoke Access" button
- Permission display read-only (changes require revoke + re-invite)

### Implementation
- Reuses `invitations` table — `role = 'accountant'` distinguishes from member invites
- Acceptance logic branches based on role

---

## 5. Onboarding Team Step & Role Guards

### Onboarding Wizard — New Step 3: "Add Your Team" (optional)
- Inserted between Step 2 (Contact & Address) and current Step 3 (Documents Guidance)
- UI: repeatable rows with email + role dropdown
- "Add another" button, "Skip for now" button prominently visible
- On submit: creates invitations + sends emails via Resend
- Wizard becomes 6 steps total

### Role-Based UI Guards
- `member`: hide invite/manage actions on Members page, hide org settings edit
- `admin`: full access except can't remove/demote owner
- `owner`: full access
- Implementation: `useCurrentMemberRole()` hook, components conditionally render
- Server actions validate role before executing

### No RLS Changes Needed
- Existing policies gate by org membership
- UI guards + server action checks provide role enforcement
