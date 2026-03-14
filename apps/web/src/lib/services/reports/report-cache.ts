import type { SupabaseClient } from "@supabase/supabase-js"

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

type ReportType =
  | "category_breakdown"
  | "client_pl"
  | "project_pl"
  | "remaining_work"

export async function getCachedOrGenerate<T>(
  supabase: SupabaseClient,
  organizationId: string,
  reportType: ReportType,
  periodFrom: string,
  periodTo: string,
  params: Record<string, unknown>,
  generateFn: () => Promise<T>,
  options?: { skipCache?: boolean }
): Promise<{ data: T; cached: boolean; generatedAt: string }> {
  // 1. Check for cached snapshot (unless skipCache)
  if (!options?.skipCache) {
    const { data: snapshot } = await supabase
      .from("report_snapshots" as any)
      .select("data, generated_at, parameters")
      .eq("organization_id", organizationId)
      .eq("report_type", reportType)
      .eq("period_from", periodFrom)
      .eq("period_to", periodTo)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // 2. If found and < 1 hour old, return cached data
    if (snapshot) {
      const generatedAt = snapshot.generated_at as string
      const age = Date.now() - new Date(generatedAt).getTime()

      // Check params match
      const cachedParams = (snapshot.parameters as Record<string, unknown>) ?? {}
      const paramsMatch =
        JSON.stringify(cachedParams) === JSON.stringify(params)

      if (age < CACHE_TTL_MS && paramsMatch) {
        return {
          data: snapshot.data as T,
          cached: true,
          generatedAt,
        }
      }
    }
  }

  // 3. Generate fresh via generateFn()
  const data = await generateFn()
  const generatedAt = new Date().toISOString()

  // 4. Upsert into report_snapshots
  // Delete old snapshot for the same org/type/period first, then insert
  await supabase
    .from("report_snapshots" as any)
    .delete()
    .eq("organization_id", organizationId)
    .eq("report_type", reportType)
    .eq("period_from", periodFrom)
    .eq("period_to", periodTo)

  await supabase.from("report_snapshots" as any).insert({
    organization_id: organizationId,
    report_type: reportType,
    period_from: periodFrom,
    period_to: periodTo,
    parameters: params,
    data,
    generated_at: generatedAt,
  })

  // 5. Return { data, cached, generatedAt }
  return {
    data,
    cached: false,
    generatedAt,
  }
}
