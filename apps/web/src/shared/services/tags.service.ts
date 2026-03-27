/**
 * Tags Service
 *
 * CRUD operations for tags (client/project/custom) and entity-tag associations.
 * Enables P&L reporting by client or project dimension.
 *
 * Usage:
 *   const tags = await listTags(supabase, orgId, "client")
 *   await tagEntity(supabase, tagId, "document", docId)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export type TagType = "client" | "project" | "custom"
export type EntityType = "document" | "invoice" | "ledger_entry"

export interface Tag {
  id: string
  organization_id: string
  name: string
  tag_type: TagType
  color: string | null
  created_at: string
}

export interface EntityTag {
  id: string
  tag_id: string
  entity_type: EntityType
  entity_id: string
  created_at: string
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createTag(
  supabase: SupabaseClient,
  organizationId: string,
  data: { name: string; tagType: TagType; color?: string }
): Promise<Tag | null> {
  const { data: tag, error } = await supabase.from("tags")
    .insert({
      organization_id: organizationId,
      name: data.name,
      tag_type: data.tagType,
      color: data.color ?? null,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[tags] Failed to create tag:", error.message)
    return null
  }
  return tag as Tag
}

export async function listTags(
  supabase: SupabaseClient,
  organizationId: string,
  tagType?: TagType
): Promise<Tag[]> {
  let query = supabase
    .from("tags")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (tagType) query = query.eq("tag_type", tagType)

  const { data, error } = await query

  if (error) {
    console.error("[tags] Failed to list tags:", error.message)
    return []
  }
  return (data ?? []) as Tag[]
}

export async function deleteTag(
  supabase: SupabaseClient,
  tagId: string
): Promise<boolean> {
  const { error } = await supabase.from("tags").delete().eq("id", tagId)
  if (error) {
    console.error("[tags] Failed to delete tag:", error.message)
    return false
  }
  return true
}

// ─── Entity Tagging ──────────────────────────────────────────────────────────

export async function tagEntity(
  supabase: SupabaseClient,
  tagId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const { error } = await supabase.from("entity_tags")
    .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })

  if (error) {
    if (error.code === "23505") return true  // already tagged (unique constraint)
    console.error("[tags] Failed to tag entity:", error.message)
    return false
  }
  return true
}

export async function untagEntity(
  supabase: SupabaseClient,
  tagId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("entity_tags")
    .delete()
    .eq("tag_id", tagId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)

  if (error) {
    console.error("[tags] Failed to untag entity:", error.message)
    return false
  }
  return true
}

export async function getEntityTags(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("entity_tags")
    .select("tag_id, tags(*)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)

  if (error) {
    console.error("[tags] Failed to get entity tags:", error.message)
    return []
  }

  return ((data ?? []) as unknown as { tags: Tag }[]).map((row) => row.tags)
}

export async function getEntitiesByTag(
  supabase: SupabaseClient,
  tagId: string,
  entityType?: EntityType
): Promise<EntityTag[]> {
  let query = supabase
    .from("entity_tags")
    .select("*")
    .eq("tag_id", tagId)

  if (entityType) query = query.eq("entity_type", entityType)

  const { data, error } = await query

  if (error) {
    console.error("[tags] Failed to get entities by tag:", error.message)
    return []
  }
  return (data ?? []) as EntityTag[]
}
