/**
 * GET  /api/queue — list jobs for an organization
 * POST /api/queue — enqueue a new job
 *
 * GET query params:
 *   organization_id — required
 *   job_type        — optional filter
 *   status          — optional filter: "pending" | "processing" | "done" | "failed" | "cancelled"
 *   limit           — optional (default 50)
 *   offset          — optional (default 0)
 *
 * POST body (JSON):
 *   {
 *     organization_id: string
 *     job_type:        string
 *     payload?:        object
 *     priority?:       number
 *     scheduled_at?:   string (ISO datetime)
 *   }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { enqueueJob, listJobs } from "@/lib/services/queue.service"
import type { JobStatus } from "@/lib/services/queue.service"

// ─── Validation schemas ───────────────────────────────────────────────────────

const EnqueueSchema = z.object({
  organization_id: z.string().uuid(),
  job_type: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).default({}),
  priority: z.number().int().min(0).max(9999).default(0),
  scheduled_at: z.string().datetime().optional(),
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

    const data = await listJobs(supabase, organizationId, {
      jobType: url.searchParams.get("job_type") ?? undefined,
      status: (url.searchParams.get("status") as JobStatus) ?? undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "50", 10),
      offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
    })

    return NextResponse.json({ data })
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
    const parsed = EnqueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { organization_id, ...fields } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const job = await enqueueJob(supabase, {
      organizationId: organization_id,
      jobType: fields.job_type,
      payload: fields.payload,
      priority: fields.priority,
      scheduledAt: fields.scheduled_at ? new Date(fields.scheduled_at) : undefined,
      createdBy: user.id,
    })

    if (!job) {
      return NextResponse.json({ error: "Failed to enqueue job" }, { status: 500 })
    }

    return NextResponse.json({ data: job }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
