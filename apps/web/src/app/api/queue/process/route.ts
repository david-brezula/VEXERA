/**
 * POST /api/queue/process — Process pending jobs from the queue.
 *
 * Triggered by a cron job or external scheduler.
 * Dequeues up to `batch_size` jobs and dispatches them to handlers.
 *
 * Query params:
 *   job_types  — optional comma-separated filter (e.g. "recurring_invoice,health_check")
 *   batch_size — optional (default 10, max 50)
 *
 * Security: Requires Authorization header with a shared secret
 * (QUEUE_PROCESS_SECRET env var) since this is a system endpoint.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dequeueJob, markJobComplete, markJobFailed } from "@/lib/services/queue.service"
import type { Job } from "@/lib/services/queue.service"
import { sendInvoiceEmailSystem } from "@/lib/services/invoice-email.service"

// ─── Job Handlers Registry ──────────────────────────────────────────────────

type JobHandler = (supabase: Awaited<ReturnType<typeof createClient>>, job: Job) => Promise<Record<string, unknown> | void>

const jobHandlers: Record<string, JobHandler> = {
  recurring_invoice: async (supabase, job) => {
    const { action, invoiceId, recipientEmail } = job.payload as {
      action: string
      invoiceId: string
      recipientEmail: string
    }

    if (action === "send_email" && invoiceId && recipientEmail) {
      const orgId = job.organization_id
      if (!orgId) {
        throw new Error("recurring_invoice job missing organization_id")
      }

      const result = await sendInvoiceEmailSystem(supabase, invoiceId, recipientEmail, orgId)
      if (result.error) {
        throw new Error(result.error)
      }

      return { sent: true, invoiceId, recipientEmail }
    }

    throw new Error(`Unknown recurring_invoice action: ${action}`)
  },
  // "health_check": processHealthCheckJob,
  // "ml_retrain": processMLRetrainJob,
  // "retention_check": processRetentionCheckJob,
  // "audit_bundle": processAuditBundleJob,
}

/**
 * Register a job handler for a specific job type.
 * Call this from service modules to plug in their handlers.
 */
export function registerJobHandler(jobType: string, handler: JobHandler) {
  jobHandlers[jobType] = handler
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedSecret = process.env.QUEUE_PROCESS_SECRET

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const jobTypesParam = url.searchParams.get("job_types")
    const jobTypes = jobTypesParam ? jobTypesParam.split(",").map(t => t.trim()) : undefined
    const batchSize = Math.min(parseInt(url.searchParams.get("batch_size") ?? "10", 10), 50)

    const supabase = await createClient()

    const results: { jobId: string; jobType: string; status: "done" | "failed"; error?: string }[] = []

    for (let i = 0; i < batchSize; i++) {
      const job = await dequeueJob(supabase, jobTypes)
      if (!job) break  // no more pending jobs

      const handler = jobHandlers[job.job_type]

      if (!handler) {
        await markJobFailed(supabase, job.id, `No handler registered for job type: ${job.job_type}`)
        results.push({ jobId: job.id, jobType: job.job_type, status: "failed", error: "No handler" })
        continue
      }

      try {
        const result = await handler(supabase, job)
        await markJobComplete(supabase, job.id, result as Record<string, unknown> | undefined)
        results.push({ jobId: job.id, jobType: job.job_type, status: "done" })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        await markJobFailed(supabase, job.id, errorMessage)
        results.push({ jobId: job.id, jobType: job.job_type, status: "failed", error: errorMessage })
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
