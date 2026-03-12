/**
 * GET /api/contacts/lookup — look up a company by IČO from Slovak registers
 *
 * Query params:
 *   ico — required, Slovak company IČO
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lookupByICO, isValidICO } from "@/lib/services/register-lookup.service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const ico = url.searchParams.get("ico")
    if (!ico) {
      return NextResponse.json({ error: "ico is required" }, { status: 400 })
    }

    if (!isValidICO(ico)) {
      return NextResponse.json({ error: "Invalid IČO format" }, { status: 400 })
    }

    const result = await lookupByICO(ico)
    if (!result) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
