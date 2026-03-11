/**
 * AI Chat Service
 *
 * Processes natural language queries about financial data using Claude API.
 * Generates safe, read-only queries against org data and formats responses.
 *
 * SAFETY: This service NEVER generates mutations. All data access is
 * read-only with organization_id filtering enforced at the query level.
 *
 * Usage:
 *   const response = await processQuery(supabase, orgId, userId, "How much did I spend on marketing?")
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  session_id: string
  role: "user" | "assistant" | "system"
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ChatSession {
  id: string
  organization_id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ProcessQueryResult {
  sessionId: string
  response: string
  metadata: Record<string, unknown>
}

// ─── Context Building ────────────────────────────────────────────────────────

async function buildOrgContext(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  // Fetch org metadata
  const { data: org } = await supabase
    .from("organizations")
    .select("name, country, currency")
    .eq("id", organizationId)
    .single()

  const orgInfo = org as unknown as { name: string; country: string; currency: string } | null

  // Get summary stats
  const { count: docCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  // Get categories in use
  const { data: categories } = await supabase
    .from("documents")
    .select("category")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("category", "is", null)

  const uniqueCategories = [...new Set(
    ((categories ?? []) as unknown as { category: string }[]).map(c => c.category)
  )]

  return `
Organization: ${orgInfo?.name ?? "Unknown"}
Country: ${orgInfo?.country ?? "SK"}
Currency: ${orgInfo?.currency ?? "EUR"}
Total documents: ${docCount ?? 0}
Total invoices: ${invoiceCount ?? 0}
Categories in use: ${uniqueCategories.join(", ") || "none"}

Available data tables (read-only):
- documents: id, supplier_name, supplier_ico, document_type, category, total_amount, vat_amount, vat_rate, currency, issue_date, due_date, status
- invoices: id, invoice_type (issued/received), customer_name, total_amount, vat_amount, currency, issue_date, due_date, status, paid_at
- bank_transactions: id, amount, currency, date, description, variable_symbol, counterparty_name, matched_invoice_id
- ledger_entries: id, account_number, debit, credit, description, entry_date
`.trim()
  }

// ─── Session Management ──────────────────────────────────────────────────────

async function getOrCreateSession(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  sessionId?: string
): Promise<string> {
  if (sessionId) {
    // Verify session exists and belongs to user
    const { data } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single()

    if (data) return (data as unknown as { id: string }).id
  }

  // Create new session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newSession, error } = await (supabase.from("chat_sessions" as any) as any)
    .insert({
      organization_id: organizationId,
      user_id: userId,
    })
    .select("id")
    .single()

  if (error || !newSession) {
    throw new Error("Failed to create chat session")
  }

  return (newSession as { id: string }).id
}

async function saveMessage(
  supabase: SupabaseClient,
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("chat_messages" as any) as any).insert({
    session_id: sessionId,
    role,
    content,
    metadata,
  })
}

// ─── Query Processing ────────────────────────────────────────────────────────

/**
 * Fetches financial data based on the user's query to provide context to Claude.
 */
async function fetchRelevantData(
  supabase: SupabaseClient,
  organizationId: string,
  query: string
): Promise<string> {
  const lowerQuery = query.toLowerCase()
  const results: string[] = []

  // Revenue / expenses queries
  if (lowerQuery.includes("tržb") || lowerQuery.includes("revenue") || lowerQuery.includes("príj") ||
      lowerQuery.includes("výnos") || lowerQuery.includes("expense") || lowerQuery.includes("náklad") ||
      lowerQuery.includes("spend") || lowerQuery.includes("zisk") || lowerQuery.includes("profit") ||
      lowerQuery.includes("cost") || lowerQuery.includes("výdav") || lowerQuery.includes("utratil")) {

    // Get monthly totals for the last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

    const { data: docs } = await supabase
      .from("documents")
      .select("document_type, category, total_amount, currency, issue_date")
      .eq("organization_id", organizationId)
      .gte("issue_date", twelveMonthsAgo.toISOString().split("T")[0])
      .is("deleted_at", null)

    if (docs && docs.length > 0) {
      const typedDocs = docs as unknown as { document_type: string; category: string; total_amount: number; currency: string; issue_date: string }[]

      // Group by category
      const byCategory = new Map<string, number>()
      let totalExpenses = 0
      let totalRevenue = 0

      for (const doc of typedDocs) {
        const cat = doc.category ?? "Bez kategórie"
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + (doc.total_amount ?? 0))

        if (["invoice_received", "receipt", "expense"].includes(doc.document_type)) {
          totalExpenses += doc.total_amount ?? 0
        } else {
          totalRevenue += doc.total_amount ?? 0
        }
      }

      results.push(`Financial summary (last 12 months):`)
      results.push(`Total expenses: ${totalExpenses.toFixed(2)} EUR`)
      results.push(`Total revenue from documents: ${totalRevenue.toFixed(2)} EUR`)
      results.push(`\nExpenses by category:`)
      for (const [cat, amount] of Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        results.push(`  ${cat}: ${amount.toFixed(2)} EUR`)
      }
    }

    // Also get invoice revenue
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total_amount, status")
      .eq("organization_id", organizationId)
      .eq("invoice_type", "issued")
      .gte("issue_date", twelveMonthsAgo.toISOString().split("T")[0])

    if (invoices && invoices.length > 0) {
      const totalInvoiced = (invoices as unknown as { total_amount: number }[])
        .reduce((s, i) => s + (i.total_amount ?? 0), 0)
      results.push(`\nTotal invoiced (issued): ${totalInvoiced.toFixed(2)} EUR`)
    }
  }

  // Overdue invoices
  if (lowerQuery.includes("overdue") || lowerQuery.includes("splatn") || lowerQuery.includes("nezaplat") || lowerQuery.includes("dlh")) {
    const today = new Date().toISOString().split("T")[0]

    const { data: overdue } = await supabase
      .from("invoices")
      .select("customer_name, total_amount, due_date, currency")
      .eq("organization_id", organizationId)
      .eq("invoice_type", "issued")
      .eq("status", "sent")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(20)

    if (overdue && overdue.length > 0) {
      results.push(`\nOverdue invoices (${overdue.length}):`)
      for (const inv of overdue as unknown as { customer_name: string; total_amount: number; due_date: string; currency: string }[]) {
        results.push(`  ${inv.customer_name}: ${inv.total_amount} ${inv.currency} (due: ${inv.due_date})`)
      }
    }
  }

  // Supplier queries
  if (lowerQuery.includes("dodávateľ") || lowerQuery.includes("supplier") || lowerQuery.includes("vendor")) {
    const { data: suppliers } = await supabase
      .from("documents")
      .select("supplier_name, total_amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("supplier_name", "is", null)

    if (suppliers && suppliers.length > 0) {
      const bySupplier = new Map<string, number>()
      for (const doc of suppliers as unknown as { supplier_name: string; total_amount: number }[]) {
        bySupplier.set(doc.supplier_name, (bySupplier.get(doc.supplier_name) ?? 0) + (doc.total_amount ?? 0))
      }
      results.push(`\nTop suppliers by total amount:`)
      for (const [name, amount] of Array.from(bySupplier.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        results.push(`  ${name}: ${amount.toFixed(2)} EUR`)
      }
    }
  }

  return results.join("\n")
}

// ─── Main Query Handler ─────────────────────────────────────────────────────

export async function processQuery(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  message: string,
  sessionId?: string
): Promise<ProcessQueryResult> {
  // Get or create session
  const sid = await getOrCreateSession(supabase, organizationId, userId, sessionId)

  // Save user message
  await saveMessage(supabase, sid, "user", message)

  // Build context
  const orgContext = await buildOrgContext(supabase, organizationId)
  const relevantData = await fetchRelevantData(supabase, organizationId, message)

  // Get conversation history (last 10 messages)
  const { data: historyData } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sid)
    .order("created_at", { ascending: true })
    .limit(10)

  const history = (historyData ?? []) as unknown as { role: string; content: string }[]

  // Call Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const errorResponse = "AI chatbot nie je nakonfigurovaný. Kontaktujte administrátora."
    await saveMessage(supabase, sid, "assistant", errorResponse)
    return { sessionId: sid, response: errorResponse, metadata: { error: "missing_api_key" } }
  }

  const systemPrompt = `You are a helpful financial assistant for the company described below. Answer questions about their financial data in Slovak language. Be concise, use numbers and tables when appropriate. Format currency amounts with 2 decimal places.

IMPORTANT RULES:
- Only use the data provided below to answer questions. Do not make up numbers.
- If you don't have enough data to answer precisely, say so.
- Never suggest actions that modify data.
- Always respond in Slovak language.

${orgContext}

${relevantData ? `\nRelevant financial data:\n${relevantData}` : ""}`

  const messages = history
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[ai-chat] Claude API error:", error)
      const fallback = "Prepáčte, nastala chyba pri spracovaní otázky. Skúste to prosím znova."
      await saveMessage(supabase, sid, "assistant", fallback, { error })
      return { sessionId: sid, response: fallback, metadata: { error } }
    }

    const result = await response.json() as {
      content: { type: string; text: string }[]
    }

    const assistantResponse = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")

    // Save assistant response
    await saveMessage(supabase, sid, "assistant", assistantResponse, {
      model: "claude-sonnet-4-6",
      hasData: !!relevantData,
    })

    // Update session title from first message
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("title")
      .eq("id", sid)
      .single()

    if (!(sessionData as unknown as { title: string | null })?.title) {
      const title = message.length > 50 ? message.slice(0, 47) + "..." : message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("chat_sessions" as any) as any)
        .update({ title })
        .eq("id", sid)
    }

    return {
      sessionId: sid,
      response: assistantResponse,
      metadata: { model: "claude-sonnet-4-6", hasData: !!relevantData },
    }
  } catch (err) {
    console.error("[ai-chat] Error calling Claude API:", err)
    const fallback = "Prepáčte, nastala chyba pri komunikácii s AI. Skúste to prosím neskôr."
    await saveMessage(supabase, sid, "assistant", fallback)
    return { sessionId: sid, response: fallback, metadata: { error: String(err) } }
  }
}

// ─── Session Queries ─────────────────────────────────────────────────────────

export async function listSessions(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  limit: number = 20
): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as unknown as ChatSession[]
}

export async function getSessionMessages(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (error) return []
  return (data ?? []) as unknown as ChatMessage[]
}
