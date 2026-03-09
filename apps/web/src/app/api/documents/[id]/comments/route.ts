/**
 * GET  /api/documents/[id]/comments — list comments for a document
 * POST /api/documents/[id]/comments — add a comment to a document
 *
 * GET returns comments joined with profiles for user_name, ordered by created_at ASC.
 * POST creates a comment and notifies other participants (previous commenters + uploader).
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/services/notification.service"

const CreateCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required").max(5000),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Fetch the document to verify it exists and get the org_id
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", documentId)
      .is("deleted_at", null)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const document = doc as unknown as { id: string; organization_id: string }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", document.organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch comments joined with profiles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comments, error: commentsErr } = await (supabase as any)
      .from("document_comments")
      .select("id, document_id, organization_id, user_id, content, created_at, profiles(full_name, email)")
      .eq("document_id", documentId)
      .eq("organization_id", document.organization_id)
      .order("created_at", { ascending: true })

    if (commentsErr) {
      return NextResponse.json(
        { error: `Failed to fetch comments: ${commentsErr.message}` },
        { status: 500 }
      )
    }

    // Map the joined profiles data into flat fields
    const mapped = ((comments ?? []) as Array<Record<string, unknown>>).map((c) => {
      const profile = c.profiles as { full_name?: string; email?: string } | null
      return {
        id: c.id,
        document_id: c.document_id,
        organization_id: c.organization_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        user_name: profile?.full_name ?? null,
        user_email: profile?.email ?? null,
      }
    })

    return NextResponse.json({ data: mapped, count: mapped.length })
  } catch (err) {
    console.error("GET /api/documents/[id]/comments error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Parse + validate body
    const body = await request.json()
    const parsed = CreateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Fetch the document to verify it exists and get org_id + uploader
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, organization_id, uploaded_by, name")
      .eq("id", documentId)
      .is("deleted_at", null)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const document = doc as unknown as {
      id: string
      organization_id: string
      uploaded_by: string | null
      name: string
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", document.organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Insert the comment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertErr } = await (supabase as any)
      .from("document_comments")
      .insert({
        document_id: documentId,
        organization_id: document.organization_id,
        user_id: user.id,
        content: parsed.data.content,
      })
      .select("id, document_id, organization_id, user_id, content, created_at")
      .single()

    if (insertErr || !created) {
      return NextResponse.json(
        { error: `Failed to create comment: ${insertErr?.message ?? "unknown error"}` },
        { status: 500 }
      )
    }

    // Notify other participants (previous commenters + document uploader)
    // Runs in the background — non-fatal
    notifyParticipants(supabase, {
      documentId,
      documentName: document.name,
      organizationId: document.organization_id,
      uploadedBy: document.uploaded_by,
      commenterId: user.id,
    }).catch((err) => console.error("[comments] notify error:", err))

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    console.error("POST /api/documents/[id]/comments error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function notifyParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ctx: {
    documentId: string
    documentName: string
    organizationId: string
    uploadedBy: string | null
    commenterId: string
  }
) {
  // Gather unique user IDs of previous commenters
  const { data: previousComments } = await supabase
    .from("document_comments")
    .select("user_id")
    .eq("document_id", ctx.documentId)
    .eq("organization_id", ctx.organizationId)

  const participantIds = new Set<string>()

  // Add previous commenters
  if (previousComments) {
    for (const c of previousComments as Array<{ user_id: string | null }>) {
      if (c.user_id) participantIds.add(c.user_id)
    }
  }

  // Add the document uploader
  if (ctx.uploadedBy) {
    participantIds.add(ctx.uploadedBy)
  }

  // Remove the commenter themselves — they don't need a notification
  participantIds.delete(ctx.commenterId)

  // Send notifications
  for (const userId of participantIds) {
    await createNotification(supabase, {
      organizationId: ctx.organizationId,
      userId,
      type: "system",
      title: `New comment on "${ctx.documentName}"`,
      body: "Someone added a comment to a document you are involved with.",
      entityType: "document",
      entityId: ctx.documentId,
    })
  }
}
