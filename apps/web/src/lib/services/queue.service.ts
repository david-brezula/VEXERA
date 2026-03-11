/**
 * Job Queue Service
 *
 * Generic async job queue backed by Supabase/PostgreSQL.
 * Workers dequeue jobs using SELECT ... FOR UPDATE SKIP LOCKED
 * for safe concurrent processing.
 *
 * Usage:
 *   await enqueueJob(supabase, {
 *     organizationId: orgId,
 *     jobType: "recurring_invoice",
 *     payload: { templateId: "..." },
 *   })
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export type JobType =
  | "recurring_invoice"
  | "health_check"
  | "ml_retrain"
  | "export"
  | "ai_query"
  | "email_tracking"
  | "retention_check"
  | "audit_bundle"

export type JobStatus = "pending" | "processing" | "done" | "failed" | "cancelled"

export interface EnqueueJobParams {
  organizationId?: string | null
  jobType: JobType | string
  payload?: Record<string, unknown>
  priority?: number
  scheduledAt?: Date
  maxAttempts?: number
  createdBy?: string | null
}

export interface Job {
  id: string
  organization_id: string | null
  job_type: string
  payload: Record<string, unknown>
  status: JobStatus
  priority: number
  attempts: number
  max_attempts: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  result: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export async function enqueueJob(
  supabase: SupabaseClient,
  params: EnqueueJobParams
): Promise<Job | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("job_queue" as any) as any)
      .insert({
        organization_id: params.organizationId ?? null,
        job_type: params.jobType,
        payload: params.payload ?? {},
        priority: params.priority ?? 0,
        scheduled_at: params.scheduledAt?.toISOString() ?? new Date().toISOString(),
        max_attempts: params.maxAttempts ?? 3,
        created_by: params.createdBy ?? null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[queue] Failed to enqueue job:", error.message)
      return null
    }

    return data as Job
  } catch (err) {
    console.error("[queue] Unexpected error enqueuing job:", err)
    return null
  }
}

// ─── Dequeue ─────────────────────────────────────────────────────────────────

/**
 * Picks the next pending job of the given type(s) and marks it as processing.
 * Uses advisory lock pattern to prevent double-processing.
 */
export async function dequeueJob(
  supabase: SupabaseClient,
  jobTypes?: string[]
): Promise<Job | null> {
  try {
    // Build filter for job types
    let query = supabase
      .from("job_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(1)

    if (jobTypes && jobTypes.length > 0) {
      query = query.in("job_type", jobTypes)
    }

    const { data: jobs, error: selectError } = await query

    if (selectError || !jobs || jobs.length === 0) return null

    const job = jobs[0] as unknown as Job

    // Atomically claim the job by setting status to processing
    // Only succeeds if status is still 'pending' (optimistic lock)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimed, error: updateError } = await (supabase.from("job_queue" as any) as any)
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq("id", job.id)
      .eq("status", "pending")  // optimistic lock
      .select("*")
      .single()

    if (updateError || !claimed) {
      // Another worker claimed it — try again
      return null
    }

    return claimed as Job
  } catch (err) {
    console.error("[queue] Unexpected error dequeuing job:", err)
    return null
  }
}

// ─── Complete ────────────────────────────────────────────────────────────────

export async function markJobComplete(
  supabase: SupabaseClient,
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("job_queue" as any) as any)
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        result: result ?? null,
      })
      .eq("id", jobId)

    if (error) {
      console.error("[queue] Failed to mark job complete:", error.message)
    }
  } catch (err) {
    console.error("[queue] Unexpected error marking job complete:", err)
  }
}

// ─── Fail ────────────────────────────────────────────────────────────────────

export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string
): Promise<void> {
  try {
    // Check if job has remaining attempts — if so, re-queue as pending
    const { data: job } = await supabase
      .from("job_queue")
      .select("attempts, max_attempts")
      .eq("id", jobId)
      .single()

    const jobData = job as unknown as { attempts: number; max_attempts: number } | null

    const shouldRetry = jobData && jobData.attempts < jobData.max_attempts
    const newStatus = shouldRetry ? "pending" : "failed"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("job_queue" as any) as any)
      .update({
        status: newStatus,
        error_message: errorMessage,
        ...(newStatus === "failed" ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", jobId)

    if (error) {
      console.error("[queue] Failed to mark job failed:", error.message)
    }
  } catch (err) {
    console.error("[queue] Unexpected error marking job failed:", err)
  }
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("job_queue" as any) as any)
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "pending")  // can only cancel pending jobs

    if (error) {
      console.error("[queue] Failed to cancel job:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[queue] Unexpected error cancelling job:", err)
    return false
  }
}

// ─── Query ───────────────────────────────────────────────────────────────────

export async function getJobStatus(
  supabase: SupabaseClient,
  jobId: string
): Promise<Job | null> {
  try {
    const { data, error } = await supabase
      .from("job_queue")
      .select("*")
      .eq("id", jobId)
      .single()

    if (error) return null
    return data as unknown as Job
  } catch {
    return null
  }
}

export async function listJobs(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { jobType?: string; status?: JobStatus; limit?: number; offset?: number }
): Promise<Job[]> {
  try {
    let query = supabase
      .from("job_queue")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50)

    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
    if (options?.jobType) query = query.eq("job_type", options.jobType)
    if (options?.status) query = query.eq("status", options.status)

    const { data, error } = await query

    if (error) {
      console.error("[queue] Failed to list jobs:", error.message)
      return []
    }

    return (data ?? []) as unknown as Job[]
  } catch (err) {
    console.error("[queue] Unexpected error listing jobs:", err)
    return []
  }
}
