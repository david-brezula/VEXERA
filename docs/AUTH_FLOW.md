# Authentication Flow

This document explains how authentication and session management work in Vexera — from signing up to being redirected to the dashboard.

---

## Overview

Vexera uses **Supabase Auth** for all authentication. It handles:
- Email + password registration and login
- Session tokens (JWTs stored in cookies)
- Automatic session refresh

The browser never stores raw passwords. Supabase issues a JWT (JSON Web Token) that proves the user is logged in. Every Supabase database query automatically reads this token and identifies the user.

---

## Registration Flow

```
User fills register form
        │
        ▼
Zod validates inputs (client-side)
        │
        ▼
supabase.auth.signUp({ email, password, options: { data: { full_name } } })
        │
        ├── Supabase creates user in auth.users
        │
        ├── handle_new_user() trigger fires automatically
        │       └── Inserts row into profiles table
        │
        ├── Returns session with access_token + refresh_token
        │
        ▼
SupabaseProvider.onAuthStateChange fires
        │
        ├── Sets user state
        └── Upserts profile (safety net in case trigger missed)
                │
                ▼
        OrganizationProvider fetches user's orgs
                │
                ├── No orgs found → redirect to /onboarding
                └── Orgs found → redirect to /dashboard
```

### The register page (`/register`)

Key code in `src/app/(auth)/register/page.tsx`:

```typescript
const { error } = await supabase.auth.signUp({
  email: values.email,
  password: values.password,
  options: {
    data: {
      full_name: values.fullName,   // stored in auth.users.raw_user_meta_data
    },
  },
})
```

After sign-up, `onAuthStateChange` fires in `SupabaseProvider` with a `SIGNED_IN` event and a session, which triggers the app to route the user appropriately.

---

## Login Flow

```
User fills login form
        │
        ▼
supabase.auth.signInWithPassword({ email, password })
        │
        ├── Supabase validates credentials
        ├── Issues JWT (access token + refresh token)
        └── Stores tokens in cookies (httpOnly)
                │
                ▼
        SupabaseProvider.onAuthStateChange fires (SIGNED_IN)
                │
                ├── Sets user in React state
                └── Upserts profile
                        │
                        ▼
                OrganizationProvider loads user's orgs
                        │
                        └── Redirects to /
```

---

## Session Management

Supabase uses two tokens:

| Token | Where stored | Lifetime | Purpose |
|---|---|---|---|
| Access token | Cookie (httpOnly) | ~1 hour | Proves identity to Supabase/PostgREST |
| Refresh token | Cookie (httpOnly) | Weeks | Gets a new access token when it expires |

### Automatic refresh

The middleware (`src/middleware.ts`) calls `updateSession()` on every request. This:
1. Reads the session from cookies
2. If the access token is expired, uses the refresh token to get a new one
3. Writes the new tokens back to cookies

This happens transparently — users never get logged out unexpectedly.

### Server vs. Client Supabase client

There are two Supabase client factories:

**Browser client** — `src/lib/supabase/client.ts`
- Created once, stored in `SupabaseProvider` state
- Used in all `"use client"` components
- Reads tokens from browser cookies

**Server client** — `src/lib/supabase/server.ts`
- Created fresh per request in Server Components and API routes
- Reads tokens from request cookies via `next/headers`
- Used for SSR and API route authentication

---

## Route Protection (Middleware)

`src/middleware.ts` intercepts every request before the page loads.

```typescript
// Public routes — no auth needed
const PUBLIC_ROUTES = ["/login", "/register", "/invite", "/api/auth/callback"]

// If not logged in and route is protected → redirect to /login
// If logged in and on /login → redirect to /
```

The middleware runs on the **server edge** — it's very fast and happens before React renders anything.

---

## Profiles and the `handle_new_user` Trigger

When a user registers, Supabase creates a row in `auth.users` (internal, app can't read it directly). A PostgreSQL trigger automatically creates a matching row in `profiles` (public, app can read it).

```sql
-- Migration 002 — this trigger fires on every new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### What if the trigger didn't fire?

This can happen if a user registered **before the migrations were applied**. To handle this, `SupabaseProvider` runs a profile upsert every time the user signs in:

```typescript
// src/providers/supabase-provider.tsx
supabase.from("profiles").upsert(
  { id: currentUser.id, email: currentUser.email, ... },
  { onConflict: "id" }
)
```

`ON CONFLICT DO UPDATE` means: if the profile already exists, update it; otherwise, insert it. This is safe to run every login.

---

## Onboarding (First Organization)

After registration, the user has an account but no organizations. The `OrganizationProvider` detects this and routes them to `/onboarding`.

The onboarding flow:

```
/onboarding form submitted
        │
        ▼
1. Upsert profile (guarantees profiles row exists)
        │
        ▼
2. crypto.randomUUID() generates org ID client-side
        │
        ▼
3. INSERT into organizations (with pre-generated ID)
        │
        ▼
4. INSERT into organization_members (role: "owner")
        │
        ▼
5. Set cookie: active_organization_id=<uuid>
        │
        ▼
6. invalidateQueries(["organizations"]) → provider refetches
        │
        ▼
7. router.push("/") → dashboard
```

**Why generate the UUID client-side?**

The naive approach would be:
```typescript
const { data } = await supabase.from("organizations").insert({...}).select("id").single()
const orgId = data.id
```

But `.select()` on an INSERT triggers both the INSERT policy and the SELECT policy simultaneously. The SELECT policy requires the user to be a member — which doesn't exist yet! This causes a 403.

The fix: generate the UUID before the insert, use it directly, and skip the RETURNING clause entirely.

---

## Sign Out

```typescript
// src/components/layout/header.tsx
async function handleSignOut() {
  await supabase.auth.signOut()   // clears tokens from cookies
  router.push("/login")
  router.refresh()                // forces Next.js to re-read session
}
```

After sign-out, `onAuthStateChange` fires with `SIGNED_OUT`, which sets `user = null` in the provider. The middleware then redirects any protected routes to `/login`.

---

## Invitation Flow (Token-Based)

Inviting a team member:

```
1. Admin creates invitation → inserts into invitations table (token generated by DB)
2. Admin shares the link: https://vexera.io/invite/<token>
3. Invitee opens the link → /invite/[token]/page.tsx
4. App looks up the invitation by token, checks it's not expired/revoked
5. If invitee is not registered → show register form
6. On register/login success → accept invitation:
   a. Insert into organization_members
   b. Update invitation status to "accepted"
7. Redirect to dashboard with the new org active
```

The token is a 32-byte random hex string generated by PostgreSQL: `encode(extensions.gen_random_bytes(32), 'hex')`.

---

## Security Checklist

| Concern | How it's handled |
|---|---|
| Passwords | Never stored — Supabase hashes with bcrypt |
| Tokens | httpOnly cookies — JS can't access them |
| Cross-org access | RLS policies at DB level |
| CSRF | SameSite=Lax cookies |
| Secrets | `SUPABASE_SERVICE_ROLE_KEY` only in server-side API routes, never in browser |
| Session expiry | Auto-refresh via middleware |
| Stale sessions | `router.refresh()` after sign-out forces server re-check |
