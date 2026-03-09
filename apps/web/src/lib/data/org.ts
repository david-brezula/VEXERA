import { cookies } from "next/headers"

export async function getActiveOrgId(): Promise<string | null> {
  const store = await cookies()
  return store.get("active_organization_id")?.value ?? null
}
