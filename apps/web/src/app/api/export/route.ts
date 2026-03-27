/**
 * GET  /api/export?organization_id=<uuid>  — list export jobs for org (newest first, limit 20)
 * POST /api/export                          — create and enqueue an export job
 *
 * POST body (JSON, Zod-validated):
 * {
 *   organization_id: string (uuid)
 *   format:          "pohoda" | "money_s3" | "kros" | "csv_generic"
 *   period_from:     "YYYY-MM-DD"
 *   period_to:       "YYYY-MM-DD"
 *   include_types:   ("invoice_issued" | "invoice_received" | "receipt" | "other")[]
 * }
 *
 * POST returns 202 Accepted:
 * { job_id: string, status: "pending" }
 *
 * GET returns 200:
 * { data: ExportJob[] }  — with an optional download_url field on completed jobs
 *
 * All export_jobs DB operations use supabase.from("export_jobs").
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/shared/services/audit.server"
import { getDownloadPresignedUrl } from "@/features/documents/storage.service"
import type { ExportFormat, ExportJob } from "@vexera/types"

// ─── Validation ───────────────────────────────────────────────────────────────

const ExportFormatSchema: z.ZodType<ExportFormat> = z.enum([
  "pohoda",
  "money_s3",
  "kros",
  "csv_generic",
])

const DocumentTypeSchema = z.enum([
  "invoice_issued",
  "invoice_received",
  "receipt",
  "other",
])

const CreateExportJobSchema = z.object({
  organization_id: z.string().uuid(),
  format: ExportFormatSchema,
  period_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  period_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  include_types: z
    .array(DocumentTypeSchema)
    .min(1, "At least one document type must be included"),
}).refine(
  (data) => data.period_from <= data.period_to,
  { message: "period_from must be before or equal to period_to", path: ["period_from"] }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Attach a presigned download URL to completed jobs that have a file_path */
async function attachDownloadUrls(
  jobs: ExportJob[]
): Promise<(ExportJob & { download_url?: string })[]> {
  return Promise.all(
    jobs.map(async (job) => {
      if (job.status === "done" && job.file_path) {
        try {
          const download_url = await getDownloadPresignedUrl(job.file_path)
          return { ...job, download_url }
        } catch {
          // Non-fatal — return job without URL if presigning fails
          return job
        }
      }
      return job
    })
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json(
        { error: "organization_id is required" },
        { status: 400 }
      )
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase.from("export_jobs")
      .select(
        "id, organization_id, created_by, format, period_from, period_to, include_types, status, started_at, completed_at, error_message, file_path, row_count, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const jobs = (data ?? []) as ExportJob[]
    const jobsWithUrls = await attachDownloadUrls(jobs)

    return NextResponse.json({ data: jobsWithUrls })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateExportJobSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const {
      organization_id,
      format,
      period_from,
      period_to,
      include_types,
    } = parsed.data

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Create the export job record
    const { data: job, error: insertError } = await supabase.from("export_jobs")
      .insert({
        organization_id,
        created_by: user.id,
        format,
        period_from,
        period_to,
        include_types,
        status: "pending",
      })
      .select("id, status")
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const jobRecord = job as { id: string; status: string }

    // Audit log
    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "EXPORT_REQUESTED",
      entityType: "export_job",
      entityId: jobRecord.id,
      newData: {
        format,
        period_from,
        period_to,
        include_types,
      },
    })

    // Fire-and-forget: invoke the process-export Edge Function
    // We don't await this — the job runs asynchronously
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      // Get the auth token for the edge function call
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        fetch(`${supabaseUrl}/functions/v1/process-export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            job_id: jobRecord.id,
            organization_id,
          }),
        }).catch((err) => {
          // Non-fatal: job stays 'pending' — can be retried or picked up by a cron
          console.error("[export] Failed to invoke process-export edge function:", err)
        })
      }
    }

    return NextResponse.json(
      { job_id: jobRecord.id, status: "pending" },
      { status: 202 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
