/**
 * Bank Import Service
 *
 * Parses bank statement files (CSV, MT940) into normalized
 * BankTransactionRow objects ready for DB insertion.
 *
 * Supported formats:
 *   - CSV (generic — comma or semicolon delimited, header row expected)
 *   - MT940 (SWIFT standard, used by Slovak/Czech banks: Tatra, ČSOB, VÚB, mBank)
 *
 * Usage:
 *   const result = await parseBankStatement(file)
 *   // result.transactions → normalized rows
 *   // result.format       → detected format
 *   // result.errors       → non-fatal parse warnings
 */

export type BankTransactionRow = {
  transaction_date: string       // YYYY-MM-DD
  amount: number                  // positive = credit, negative = debit
  currency: string
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  description: string | null
  counterpart_iban: string | null
  counterpart_name: string | null
  external_id: string | null      // unique ID from bank (for deduplication)
}

export type ParseResult = {
  transactions: BankTransactionRow[]
  format: "csv" | "mt940"
  errors: string[]               // non-fatal warnings (rows that couldn't be parsed)
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────
// Tries to auto-detect Slovak bank CSV exports (Tatra banka, ČSOB, mBank, etc.)
// Falls back to generic column detection.

const CSV_DATE_PATTERNS = [
  /^(\d{2})\.(\d{2})\.(\d{4})$/,   // dd.MM.yyyy (Slovak)
  /^(\d{4})-(\d{2})-(\d{2})$/,     // yyyy-MM-dd (ISO)
  /^(\d{2})\/(\d{2})\/(\d{4})$/,   // MM/dd/yyyy (US fallback)
]

function parseDate(raw: string): string | null {
  const s = raw.trim()
  for (const pat of CSV_DATE_PATTERNS) {
    const m = s.match(pat)
    if (m) {
      // Pattern 1: dd.mm.yyyy → yyyy-mm-dd
      if (pat.source.startsWith("^(\\d{2})\\.")) {
        return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`
      }
      // Pattern 2: already ISO
      if (pat.source.startsWith("^(\\d{4})-")) {
        return s
      }
      // Pattern 3: MM/dd/yyyy
      if (pat.source.startsWith("^(\\d{2})/")) {
        return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`
      }
    }
  }
  return null
}

function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".")
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""))
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""))
  return result
}

function detectDelimiter(header: string): string {
  const semicolons = (header.match(/;/g) ?? []).length
  const commas = (header.match(/,/g) ?? []).length
  return semicolons >= commas ? ";" : ","
}

// Map of common Slovak bank CSV header aliases → canonical field names
const HEADER_MAP: Record<string, string> = {
  // dates
  "dátum": "date", "datum": "date", "date": "date",
  "dátum pohybu": "date", "booking date": "date", "value date": "date",
  // amounts
  "suma": "amount", "amount": "amount", "objem": "amount",
  "credit": "credit", "debit": "debit",
  "suma v eur": "amount",
  // currency
  "mena": "currency", "currency": "currency",
  // symbols
  "variabilný symbol": "vs", "variabilny symbol": "vs", "vs": "vs",
  "variable symbol": "vs",
  "konštantný symbol": "ks", "konstantny symbol": "ks", "ks": "ks",
  "constant symbol": "ks",
  "špecifický symbol": "ss", "specificky symbol": "ss", "ss": "ss",
  "specific symbol": "ss",
  // counterpart
  "protiúčet": "counterpart_iban", "protiucet": "counterpart_iban",
  "iban protiúčtu": "counterpart_iban", "counterpart iban": "counterpart_iban",
  "majiteľ protiúčtu": "counterpart_name", "majitel protiuctu": "counterpart_name",
  "counterpart name": "counterpart_name",
  // description / note
  "poznámka": "description", "poznamka": "description", "description": "description",
  "správa pre prijímateľa": "description", "reference": "description",
  "detail": "description", "note": "description",
  // id
  "id transakcie": "external_id", "transaction id": "external_id",
  "reference number": "external_id",
}

function normalizeHeader(raw: string): string {
  return HEADER_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim()
}

export function parseCsv(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const errors: string[] = []
  const transactions: BankTransactionRow[] = []

  if (lines.length < 2) {
    return { transactions: [], format: "csv", errors: ["File is empty or has no data rows"] }
  }

  const delimiter = detectDelimiter(lines[0]!)
  const headers = splitCsvLine(lines[0]!, delimiter).map(normalizeHeader)

  const col = (name: string) => headers.indexOf(name)

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!, delimiter)
    if (cells.every((c) => !c)) continue // skip blank lines

    const get = (name: string) => cells[col(name)]?.trim() ?? null

    const rawDate = get("date")
    const date = rawDate ? parseDate(rawDate) : null

    // Amount: could be single signed column or separate credit/debit columns
    let amount: number | null = null
    if (col("amount") >= 0) {
      amount = parseAmount(get("amount") ?? "")
    } else if (col("credit") >= 0 || col("debit") >= 0) {
      const credit = parseAmount(get("credit") ?? "") ?? 0
      const debit = parseAmount(get("debit") ?? "") ?? 0
      amount = credit - Math.abs(debit)
    }

    if (!date || amount === null) {
      errors.push(`Row ${i + 1}: skipped — missing date or amount (date=${rawDate}, cells=${cells.join("|")})`)
      continue
    }

    transactions.push({
      transaction_date: date,
      amount,
      currency: get("currency") ?? "EUR",
      variable_symbol: get("vs") || null,
      constant_symbol: get("ks") || null,
      specific_symbol: get("ss") || null,
      description: get("description") || null,
      counterpart_iban: get("counterpart_iban") || null,
      counterpart_name: get("counterpart_name") || null,
      external_id: get("external_id") || null,
    })
  }

  return { transactions, format: "csv", errors }
}

// ─── MT940 Parser ──────────────────────────────────────────────────────────────
// MT940 is a SWIFT standard used by most Slovak/Czech banks.
//
// Structure:
//   :20:   Transaction reference
//   :25:   Account identification
//   :28C:  Statement number
//   :60F:  Opening balance
//   :61:   Transaction line  (date, credit/debit mark, amount, reference)
//   :86:   Transaction details (VS, KS, SS, counterpart, description)
//   :62F:  Closing balance

export function parseMt940(content: string): ParseResult {
  const errors: string[] = []
  const transactions: BankTransactionRow[] = []

  // Split into individual transaction blocks (each starts with :61:)
  const blocks = content.split(/(?=^:61:)/m)

  for (const block of blocks) {
    if (!block.startsWith(":61:")) continue

    const line61 = block.match(/^:61:([^\r\n]+)/m)?.[1] ?? ""
    const line86 = block.match(/^:86:([^\r\n]+(?:\r?\n(?!:)[^\r\n]*)*)/m)?.[1]?.replace(/\r?\n/g, " ") ?? ""

    // :61: format: YYMMDD[MMDD]<D|C|RD|RC><Amount>N<TxCode>[//Ref]
    // e.g. 240115D1500,00NTRFNONREF
    const m61 = line61.match(
      /^(\d{6})(?:\d{4})?([DC]R?)([0-9,]+)N([A-Z]+)(?:\/\/([^\r\n]+))?/
    )
    if (!m61) {
      errors.push(`MT940: Could not parse :61: line: ${line61}`)
      continue
    }

    const [, yymmdd, crdr, rawAmt, , refFromLine] = m61
    const year = 2000 + parseInt(yymmdd!.slice(0, 2))
    const month = yymmdd!.slice(2, 4)
    const day = yymmdd!.slice(4, 6)
    const transactionDate = `${year}-${month}-${day}`
    const sign = crdr!.startsWith("D") ? -1 : 1
    const amount = sign * parseFloat(rawAmt!.replace(",", "."))

    // Parse :86: structured field (varies by bank, but common pattern)
    // Format: /VS/<vs>/KS/<ks>/SS/<ss>/IBAN/<iban>/BEN/<name>/MSG/<msg>
    const parseField = (key: string) =>
      line86.match(new RegExp(`/${key}/([^/]*)`))?.[1]?.trim() || null

    const vs = parseField("VS") ?? line86.match(/\bVS(\d+)/)?.[1] ?? null
    const ks = parseField("KS") ?? null
    const ss = parseField("SS") ?? null
    const counterpartIban = parseField("IBAN") ?? parseField("COUNTERP") ?? null
    const counterpartName = parseField("BEN") ?? parseField("OWNER") ?? null
    const description = parseField("MSG") ?? parseField("TEXT") ?? (line86.length > 10 ? line86.slice(0, 140) : null)

    // External ID: bank reference from :61: // or first 16 chars of :86:
    const externalId = refFromLine ?? (line86.slice(0, 16).trim() || null)

    transactions.push({
      transaction_date: transactionDate,
      amount,
      currency: "EUR", // MT940 :25: account line would have currency; simplified here
      variable_symbol: vs,
      constant_symbol: ks,
      specific_symbol: ss,
      description,
      counterpart_iban: counterpartIban,
      counterpart_name: counterpartName,
      external_id: externalId,
    })
  }

  return { transactions, format: "mt940", errors }
}

// ─── Auto-detect + parse ───────────────────────────────────────────────────────

export function parseBankStatement(content: string): ParseResult {
  const trimmed = content.trim()

  // MT940 always starts with :20:
  if (trimmed.startsWith(":20:") || trimmed.includes("\n:61:")) {
    return parseMt940(trimmed)
  }

  return parseCsv(trimmed)
}
