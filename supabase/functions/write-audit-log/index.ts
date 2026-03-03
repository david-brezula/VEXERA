// Supabase Edge Function: write-audit-log
// Centralized audit log writer — prevents client-side bypass
// Deploy with: supabase functions deploy write-audit-log

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface AuditLogPayload {
  organization_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ data: null, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create authenticated Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ data: null, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Parse the request body
    const payload: AuditLogPayload = await req.json()

    if (!payload.action || !payload.entity_type) {
      return new Response(
        JSON.stringify({ data: null, error: "Missing required fields: action, entity_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Use service role to write to audit_logs (bypasses RLS for inserts)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await serviceClient.from("audit_logs").insert({
      organization_id: payload.organization_id,
      user_id: user.id,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      old_data: payload.old_data ?? null,
      new_data: payload.new_data ?? null,
      metadata: {
        ...payload.metadata,
        user_agent: req.headers.get("user-agent"),
      },
    }).select().single()

    if (error) {
      return new Response(
        JSON.stringify({ data: null, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ data, error: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return new Response(
      JSON.stringify({ data: null, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
