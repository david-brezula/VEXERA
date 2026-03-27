/**
 * POST /api/cron/recurring — Process due recurring invoice templates.
 *
 * Triggered by an external cron scheduler (e.g. Vercel Cron, GitHub Actions).
 * Finds all active templates whose next_run_at <= today, generates invoices,
 * and enqueues auto-send email jobs where configured.
 *
 * Security: Requires Bearer token matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processRecurringInvoices } from "@/features/invoices/recurring.service"

export async function POST(req: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const result = await processRecurringInvoices(supabase)

    return NextResponse.json({
      ok: true,
      generated: result.generated,
      errors: result.errors,
    })
  } catch (err) {
    console.error("[cron/recurring] Unexpected error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
