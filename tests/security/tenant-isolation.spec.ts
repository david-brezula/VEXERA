/**
 * Tenant Isolation Security Tests
 *
 * Verifies that User A (org A) cannot access data belonging to User B (org B).
 * Tests every major entity type: documents, invoices, bank transactions,
 * bank accounts, audit logs, email connections.
 *
 * These run against a real Supabase instance (test project or local).
 * They must pass on every CI commit.
 *
 * Setup:
 *   1. Set TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY in your test .env
 *   2. Two test accounts must exist:
 *        TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD  (member of org A only)
 *        TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD  (member of org B only)
 *      and TEST_ORG_A_ID / TEST_ORG_B_ID must be valid org UUIDs
 *      with some seeded data.
 *
 * Run:
 *   pnpm --filter @vexera/web test:security
 *   # or
 *   npx vitest run tests/security/tenant-isolation.spec.ts
 */

import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// ─── Test config ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL ?? ""
const USER_A_PASSWORD = process.env.TEST_USER_A_PASSWORD ?? ""
const USER_B_EMAIL = process.env.TEST_USER_B_EMAIL ?? ""
const USER_B_PASSWORD = process.env.TEST_USER_B_PASSWORD ?? ""

const ORG_A_ID = process.env.TEST_ORG_A_ID ?? ""
const ORG_B_ID = process.env.TEST_ORG_B_ID ?? ""

// ─── Supabase client factory ──────────────────────────────────────────────────

function makeClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signIn(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = makeClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Tenant Isolation", () => {
  let clientA: SupabaseClient
  let clientB: SupabaseClient

  // Skip entire suite if env vars not configured
  const skip =
    !SUPABASE_URL ||
    !ANON_KEY ||
    !USER_A_EMAIL ||
    !USER_B_EMAIL ||
    !ORG_A_ID ||
    !ORG_B_ID

  beforeAll(async () => {
    if (skip) return
    ;[clientA, clientB] = await Promise.all([
      signIn(USER_A_EMAIL, USER_A_PASSWORD),
      signIn(USER_B_EMAIL, USER_B_PASSWORD),
    ])
  })

  // ─── Documents ───────────────────────────────────────────────────────────────

  describe("Documents", () => {
    it("User A cannot read Org B documents", async () => {
      if (skip) return
      const { data, error } = await clientA
        .from("documents")
        .select("id")
        .eq("organization_id", ORG_B_ID)
        .is("deleted_at", null)

      // RLS must return empty — not an error, just 0 rows
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User B cannot read Org A documents", async () => {
      if (skip) return
      const { data, error } = await clientB
        .from("documents")
        .select("id")
        .eq("organization_id", ORG_A_ID)
        .is("deleted_at", null)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User A cannot insert a document into Org B", async () => {
      if (skip) return
      const { error } = await clientA.from("documents").insert({
        organization_id: ORG_B_ID,
        name: "malicious.pdf",
        file_path: "fake/path/malicious.pdf",
        ocr_status: "not_queued",
      })

      // RLS must block the insert
      expect(error).not.toBeNull()
    })
  })

  // ─── Invoices ────────────────────────────────────────────────────────────────

  describe("Invoices", () => {
    it("User A cannot read Org B invoices", async () => {
      if (skip) return
      const { data, error } = await clientA
        .from("invoices")
        .select("id")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User B cannot read Org A invoices", async () => {
      if (skip) return
      const { data, error } = await clientB
        .from("invoices")
        .select("id")
        .eq("organization_id", ORG_A_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User A cannot update an Org B invoice", async () => {
      if (skip) return
      // First, get any Org B invoice ID using the service role (not tested here)
      // Instead: attempt to update all invoices in ORG_B — RLS should block all rows
      const { data, error } = await clientA
        .from("invoices")
        .update({ status: "cancelled" })
        .eq("organization_id", ORG_B_ID)
        .select("id")

      expect(error).toBeNull()
      expect(data).toHaveLength(0) // no rows updated
    })
  })

  // ─── Bank transactions ────────────────────────────────────────────────────────

  describe("Bank Transactions", () => {
    it("User A cannot read Org B bank transactions", async () => {
      if (skip) return
      // bank_transactions is not in the standard RLS — it uses organization_id
      // We rely on Supabase RLS policies on bank_transactions table
      const { data, error } = await (clientA as SupabaseClient & {
        from: (table: string) => ReturnType<SupabaseClient["from"]>
      })
        .from("bank_transactions")
        .select("id")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User A cannot read Org B bank accounts", async () => {
      if (skip) return
      const { data, error } = await (clientA as SupabaseClient & {
        from: (table: string) => ReturnType<SupabaseClient["from"]>
      })
        .from("bank_accounts")
        .select("id")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // ─── Audit logs ───────────────────────────────────────────────────────────────

  describe("Audit Logs", () => {
    it("User A cannot read Org B audit logs", async () => {
      if (skip) return
      const { data, error } = await clientA
        .from("audit_logs")
        .select("id")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("User A cannot delete audit logs (immutable)", async () => {
      if (skip) return
      // audit_logs has no DELETE policy — this should fail
      const { error } = await clientA
        .from("audit_logs")
        .delete()
        .eq("organization_id", ORG_A_ID)

      // Supabase returns an error when no DELETE policy exists
      expect(error).not.toBeNull()
    })
  })

  // ─── Email connections ────────────────────────────────────────────────────────

  describe("Email Connections", () => {
    it("User A cannot read Org B email connections", async () => {
      if (skip) return
      const { data, error } = await clientA
        .from("email_connections")
        .select("id, access_token, refresh_token")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // ─── Organization members ─────────────────────────────────────────────────────

  describe("Organization members", () => {
    it("User A can only see their own org's members", async () => {
      if (skip) return
      const { data: ownOrgMembers } = await clientA
        .from("organization_members")
        .select("organization_id")

      const orgIds = new Set((ownOrgMembers ?? []).map((m: { organization_id: string }) => m.organization_id))

      // User A should only see Org A (and possibly accountant orgs they're in)
      // They must NOT see Org B
      expect(orgIds.has(ORG_B_ID)).toBe(false)
    })
  })

  // ─── Rules engine ─────────────────────────────────────────────────────────────

  describe("Rules", () => {
    it("User A cannot read Org B rules", async () => {
      if (skip) return
      const { data, error } = await clientA
        .from("rules")
        .select("id")
        .eq("organization_id", ORG_B_ID)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })
})

// ─── Skip notice ──────────────────────────────────────────────────────────────

describe("Tenant Isolation — setup check", () => {
  it("logs a warning if test env vars are missing", () => {
    const missing = [
      !process.env.TEST_SUPABASE_URL && "TEST_SUPABASE_URL",
      !process.env.TEST_USER_A_EMAIL && "TEST_USER_A_EMAIL",
      !process.env.TEST_USER_B_EMAIL && "TEST_USER_B_EMAIL",
      !process.env.TEST_ORG_A_ID && "TEST_ORG_A_ID",
      !process.env.TEST_ORG_B_ID && "TEST_ORG_B_ID",
    ].filter(Boolean)

    if (missing.length > 0) {
      console.warn(
        `⚠️  Tenant isolation tests are SKIPPED — missing env vars: ${missing.join(", ")}\n` +
        "   Set these to run full security checks."
      )
    }

    // Always passes — this is just an informational test
    expect(true).toBe(true)
  })
})
