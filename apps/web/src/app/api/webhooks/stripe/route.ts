import { NextResponse } from "next/server"

// TODO: Phase Post-MVP 4 — Stripe webhook handler
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented" },
    { status: 501 }
  )
}
