/**
 * GET  /api/health-checks — get latest health check results
 * POST /api/health-checks — trigger a new health check run
 *
 * GET query params:
 *   organization_id — required
 *   resolved        — optional: "true" | "false"
 *   severity        — optional: "critical" | "warning" | "info"
 *   check_type      — optional filter
 *   limit           — optional (default 50)
 *   offset          — optional (default 0)
 *
 * POST body: { organization_id: string }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  runHealthChecks,
  getHealthCheckIssues,
  getLatestHealthCheckRun,
} from "@/lib/services/health-check.service"
import type { Severity, CheckType } from "@/lib/services/health-check.service"
import { writeAuditLog } from "@/lib/services/audit.server"

const TriggerSchema = z.object({
  organization_id: z.string().uuid(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const latestRun = await getLatestHealthCheckRun(supabase, organizationId)

    const issues = await getHealthCheckIssues(supabase, organizationId, {
      runId: latestRun ? (latestRun as unknown as { id: string }).id : undefined,
      resolved: url.searchParams.get("resolved") === "true"
        ? true
        : url.searchParams.get("resolved") === "false"
          ? false
          : undefined,
      severity: url.searchParams.get("severity") as Severity | undefined,
      checkType: url.searchParams.get("check_type") as CheckType | undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "50", 10),
      offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
    })

    return NextResponse.json({ data: { run: latestRun, issues } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = TriggerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { organization_id } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await runHealthChecks(supabase, organization_id, user.id)

    if (!result) {
      return NextResponse.json({ error: "Failed to run health checks" }, { status: 500 })
    }

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "HEALTH_CHECK_RUN",
      entityType: "health_check",
      entityId: result.runId,
      newData: {
        total_issues: result.totalIssues,
        critical_count: result.criticalCount,
        warning_count: result.warningCount,
      },
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
