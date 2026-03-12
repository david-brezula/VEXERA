/**
 * Slovak Business Register Lookup Service
 *
 * Looks up company data from Slovak public registers (RPO) by IČO.
 * Results are cached in-memory to reduce external API calls.
 *
 * Usage:
 *   const company = await lookupByICO("12345678")
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompanyLookupResult {
  name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country: string
  legal_form: string | null
}

// ─── In-memory cache (5 min TTL) ───────────────────────────────────────────

const cache = new Map<string, { data: CompanyLookupResult; expires: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getCached(ico: string): CompanyLookupResult | null {
  const entry = cache.get(ico)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(ico)
    return null
  }
  return entry.data
}

function setCache(ico: string, data: CompanyLookupResult): void {
  cache.set(ico, { data, expires: Date.now() + CACHE_TTL_MS })
}

// ─── RPO Lookup ─────────────────────────────────────────────────────────────

/**
 * Look up a Slovak company by IČO using the RPO API.
 * Returns null if the company is not found or the API is unreachable.
 */
export async function lookupByICO(ico: string): Promise<CompanyLookupResult | null> {
  const normalizedICO = ico.replace(/\s/g, "").padStart(8, "0")

  // Check cache first
  const cached = getCached(normalizedICO)
  if (cached) return cached

  try {
    // Slovak RPO (Register právnických osôb) API
    const response = await fetch(
      `https://rpo.statistics.sk/rpo/json/entity/${normalizedICO}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) {
      if (response.status === 404) return null
      console.error(`[register-lookup] RPO API returned ${response.status}`)
      return null
    }

    const data = await response.json()

    // Parse RPO response format
    const result = parseRPOResponse(data, normalizedICO)
    if (result) {
      setCache(normalizedICO, result)
    }
    return result
  } catch (err) {
    console.error("[register-lookup] Failed to lookup ICO:", normalizedICO, err)

    // Fallback: try ORSR (Obchodný register)
    return lookupByICO_ORSR(normalizedICO)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRPOResponse(data: any, ico: string): CompanyLookupResult | null {
  try {
    const entity = data?.entity ?? data
    if (!entity) return null

    // RPO fields vary — handle flexibly
    const name = entity.name ?? entity.full_name ?? entity.obchodne_meno ?? ""
    if (!name) return null

    const address = entity.address ?? entity.sidlo ?? {}

    return {
      name,
      ico,
      dic: entity.dic ?? null,
      ic_dph: entity.ic_dph ?? null,
      street: address.street ?? address.ulica ?? null,
      city: address.city ?? address.obec ?? null,
      postal_code: address.postal_code ?? address.psc ?? null,
      country: "SK",
      legal_form: entity.legal_form ?? entity.pravna_forma ?? null,
    }
  } catch {
    return null
  }
}

async function lookupByICO_ORSR(ico: string): Promise<CompanyLookupResult | null> {
  try {
    const response = await fetch(
      `https://www.orsr.sk/hladaj_ico.asp?ICO=${ico}&SID=0&T=f0`,
      {
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) return null

    // ORSR returns HTML — basic parsing for company name
    const html = await response.text()
    const nameMatch = html.match(/<td[^>]*class="ra"[^>]*>([^<]+)<\/td>/)
    if (!nameMatch) return null

    const result: CompanyLookupResult = {
      name: nameMatch[1].trim(),
      ico,
      dic: null,
      ic_dph: null,
      street: null,
      city: null,
      postal_code: null,
      country: "SK",
      legal_form: null,
    }

    setCache(ico, result)
    return result
  } catch {
    return null
  }
}

/**
 * Validate a Slovak IČO format (8 digits).
 */
export function isValidICO(ico: string): boolean {
  const normalized = ico.replace(/\s/g, "")
  return /^\d{6,8}$/.test(normalized)
}
