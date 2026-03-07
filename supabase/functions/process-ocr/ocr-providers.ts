/**
 * OCR provider implementations.
 * Add new providers here; select via OCR_PROVIDER env var.
 *
 * Supported values:
 *   mock           — returns deterministic fake data (dev/CI)
 *   google_vision  — Google Cloud Vision API (Document Text Detection)
 *
 * To add a new provider implement the OcrProvider interface and add
 * it to the getProvider() factory at the bottom.
 */

export interface OcrResult {
  supplier_name: string | null
  supplier_ico: string | null
  supplier_address: string | null
  customer_name: string | null
  customer_ico: string | null
  invoice_number: string | null
  issue_date: string | null   // ISO YYYY-MM-DD
  due_date: string | null     // ISO YYYY-MM-DD
  currency: string | null
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  vat_rate: number | null
  variable_symbol: string | null
  payment_method: string | null
  raw_text: string
  confidence: number          // 0–1
}

export interface OcrProvider {
  extractFromUrl(presignedUrl: string, mimeType: string): Promise<OcrResult>
}

// ─── Mock Provider ─────────────────────────────────────────────────────────────
// Returns plausible but fake Slovak invoice data. Used in development and CI.

class MockOcrProvider implements OcrProvider {
  async extractFromUrl(_url: string, _mime: string): Promise<OcrResult> {
    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 300))
    return {
      supplier_name: "MOCK s.r.o.",
      supplier_ico: "12345678",
      supplier_address: "Hlavná 1, 811 01 Bratislava",
      customer_name: null,
      customer_ico: null,
      invoice_number: "2024-001",
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      currency: "EUR",
      subtotal: 100.0,
      vat_amount: 20.0,
      total: 120.0,
      vat_rate: 20,
      variable_symbol: "20240001",
      payment_method: "bank_transfer",
      raw_text: "[mock OCR text]",
      confidence: 0.99,
    }
  }
}

// ─── Google Cloud Vision Provider ─────────────────────────────────────────────

class GoogleVisionProvider implements OcrProvider {
  constructor(private readonly apiKey: string) {}

  async extractFromUrl(presignedUrl: string, _mimeType: string): Promise<OcrResult> {
    // Download the file bytes (max 20 MB per Vision API limit)
    const fileRes = await fetch(presignedUrl)
    if (!fileRes.ok) throw new Error(`Failed to fetch file for OCR: ${fileRes.status}`)
    const buffer = await fileRes.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      }
    )

    if (!visionRes.ok) {
      const errBody = await visionRes.text()
      throw new Error(`Google Vision API error ${visionRes.status}: ${errBody}`)
    }

    const visionData = await visionRes.json() as {
      responses: Array<{
        fullTextAnnotation?: { text: string; pages?: Array<{ confidence?: number }> }
        error?: { message: string }
      }>
    }

    const response = visionData.responses[0]
    if (response?.error) throw new Error(`Vision API: ${response.error.message}`)

    const rawText = response?.fullTextAnnotation?.text ?? ""
    const confidence = response?.fullTextAnnotation?.pages?.[0]?.confidence ?? 0.5

    return { ...parseInvoiceText(rawText), raw_text: rawText, confidence }
  }
}

// ─── Text Parser ───────────────────────────────────────────────────────────────
// Extracts structured fields from raw OCR text using regex heuristics.
// This is language-agnostic but tuned for Slovak invoice conventions.

function parseInvoiceText(text: string): Omit<OcrResult, "raw_text" | "confidence"> {
  const num = (s: string | undefined): number | null =>
    s ? parseFloat(s.replace(/\s/g, "").replace(",", ".")) : null

  // Invoice number: look for "Faktúra č." or "Invoice No." followed by identifier
  const invoiceNumMatch = text.match(
    /(?:fakt[uú]ra\s*[čc]\.?|invoice\s*no\.?)\s*:?\s*([A-Z0-9/\-]+)/i
  )

  // IČO — Slovak company registration number (8 digits)
  const icoMatches = [...text.matchAll(/(?:IČO|ICO)\s*:?\s*(\d{8})/gi)]
  const supplierIco = icoMatches[0]?.[1] ?? null
  const customerIco = icoMatches[1]?.[1] ?? null

  // Dates: dd.mm.yyyy or yyyy-mm-dd
  const datePattern = /(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})/g
  const dates: string[] = []
  let m: RegExpExecArray | null
  while ((m = datePattern.exec(text)) !== null) {
    const raw = m[1]!
    if (raw.includes(".")) {
      const [d, mo, y] = raw.split(".")
      dates.push(`${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`)
    } else {
      dates.push(raw)
    }
  }

  // Variable symbol (variabilný symbol)
  const vsMatch = text.match(/(?:variabiln[ýy]\s*symbol|VS)\s*:?\s*(\d{6,10})/i)

  // Total amount — look for "Spolu" or "Total" or "Celkom" followed by currency amount
  const totalMatch = text.match(
    /(?:spolu|total|celkom)\s*:?\s*([\d\s]+[,.][\d]{2})\s*(?:€|EUR)?/i
  )
  // VAT amount
  const vatMatch = text.match(
    /(?:DPH|VAT|daň)\s*:?\s*([\d\s]+[,.][\d]{2})\s*(?:€|EUR)?/i
  )
  const vatRateMatch = text.match(/(\d{1,2})\s*%/)
  const total = num(totalMatch?.[1])
  const vatAmount = num(vatMatch?.[1])
  const vatRate = vatRateMatch ? parseInt(vatRateMatch[1]!) : null
  const subtotal = total !== null && vatAmount !== null ? total - vatAmount : null

  // Currency
  const currencyMatch = text.match(/\b(EUR|CZK|USD|GBP)\b/)

  return {
    supplier_name: null,     // Hard to parse reliably without layout info; left for human review
    supplier_ico: supplierIco,
    supplier_address: null,
    customer_name: null,
    customer_ico: customerIco,
    invoice_number: invoiceNumMatch?.[1] ?? null,
    issue_date: dates[0] ?? null,
    due_date: dates[1] ?? null,
    currency: currencyMatch?.[1] ?? "EUR",
    subtotal,
    vat_amount: vatAmount,
    total,
    vat_rate: vatRate,
    variable_symbol: vsMatch?.[1] ?? null,
    payment_method: text.match(/hotovos|cash/i) ? "cash" : "bank_transfer",
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────────

export function getOcrProvider(): OcrProvider {
  const provider = Deno.env.get("OCR_PROVIDER") ?? "mock"

  if (provider === "google_vision") {
    const key = Deno.env.get("GOOGLE_VISION_API_KEY")
    if (!key) throw new Error("GOOGLE_VISION_API_KEY env var is required for google_vision provider")
    return new GoogleVisionProvider(key)
  }

  if (provider === "mock") {
    return new MockOcrProvider()
  }

  throw new Error(`Unknown OCR_PROVIDER: ${provider}. Supported: mock, google_vision`)
}
