/**
 * send-overdue-alerts — Supabase Edge Function
 *
 * What it does (Phase 1 scaffold):
 *   1. Finds all "sent" invoices where due_date < NOW()
 *   2. Updates their status to "overdue"
 *   3. Writes an audit_log entry for each status change
 *   4. TODO Phase 2: send email notification to invoice owner
 *
 * Scheduling (deploy once Phase 2 email is ready):
 *   Run daily via Supabase Cron:
 *   SELECT cron.schedule('overdue-alerts', '0 7 * * *', $$
 *     SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/send-overdue-alerts',
 *       headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
 *     );
 *   $$);
 *
 * Local test:
 *   supabase functions serve send-overdue-alerts
 *   curl -X POST http://localhost:54321/functions/v1/send-overdue-alerts \
 *     -H "Authorization: Bearer <ANON_KEY>"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role bypasses RLS
  { auth: { persistSession: false } }
)

Deno.serve(async (_req: Request) => {
  try {
    const now = new Date().toISOString()

    // 1. Find all "sent" invoices that are past their due date
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, organization_id, invoice_number, total")
      .eq("status", "sent")
      .lt("due_date", now)
      .is("deleted_at", null)

    if (fetchError) throw fetchError

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue invoices found", updated: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    const ids = overdueInvoices.map((inv) => inv.id)

    // 2. Bulk update status → "overdue"
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", ids)

    if (updateError) throw updateError

    // 3. Write one audit log entry per invoice
    const auditEntries = overdueInvoices.map((inv) => ({
      organization_id: inv.organization_id,
      user_id: null, // system action — no user
      action: "INVOICE_STATUS_CHANGED",
      entity_type: "invoice",
      entity_id: inv.id,
      old_data: { status: "sent" },
      new_data: { status: "overdue", invoice_number: inv.invoice_number, total: inv.total },
    }))

    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert(auditEntries)

    if (auditError) {
      // Non-fatal — log but don't fail the whole function
      console.error("Audit log insert failed:", auditError.message)
    }

    // 4. TODO Phase 2: send email notifications
    // For each invoice, look up the org owner's email and send an alert:
    //   await sendEmail({ to: ownerEmail, subject: `Invoice ${inv.invoice_number} is overdue`, ... })

    return new Response(
      JSON.stringify({
        message: `Marked ${overdueInvoices.length} invoice(s) as overdue`,
        updated: overdueInvoices.length,
        invoiceIds: ids,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("send-overdue-alerts error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
