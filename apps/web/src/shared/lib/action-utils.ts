"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"

export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionError"
  }
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function withAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const orgId = await getActiveOrgId()
  if (!user) throw new ActionError("Not authenticated")
  if (!orgId) throw new ActionError("No active organization")
  return { supabase, user, orgId }
}

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function err<T>(error: string): ActionResult<T> {
  return { success: false, error }
}
