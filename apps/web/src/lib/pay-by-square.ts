import lzma from "lzma"

export interface PayBySquareInput {
  amount: number
  currencyCode: string
  iban: string
  variableSymbol?: string
  constantSymbol?: string
  specificSymbol?: string
  note?: string
  beneficiaryName?: string
  dueDate?: string  // "YYYYMMDD"
}

const BASE32_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUV"

function base32hex(buffer: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

function buildDataString(input: PayBySquareInput): string {
  const fields = [
    "",                              // payment ID
    "1",                             // payment count
    "1",                             // payment type (payment order)
    input.amount.toFixed(2),
    input.currencyCode || "EUR",
    input.dueDate || "",
    input.variableSymbol || "",
    input.constantSymbol || "",
    input.specificSymbol || "",
    "",                              // reference
    input.note || "",
    "1",                             // recipient account count
    input.iban.replace(/\s/g, ""),
    "",                              // BIC
    "",                              // standing order
    "",                              // direct debit
    input.beneficiaryName || "",
    "",                              // address line 1
    "",                              // address line 2
  ]
  return fields.join("\t")
}

export async function encodePayBySquare(input: PayBySquareInput): Promise<string> {
  const dataString = buildDataString(input)
  const dataBytes = new TextEncoder().encode(dataString)

  const compressed: number[] = await new Promise((resolve, reject) => {
    lzma.compress(
      dataString,
      6,
      (result: number[] | null, error?: Error) => {
        if (error || !result) reject(error || new Error("LZMA compression failed"))
        else resolve(result)
      }
    )
  })

  const uncompressedLen = dataBytes.length
  const header = new Uint8Array([
    (uncompressedLen >> 8) & 0xff,
    uncompressedLen & 0xff,
  ])

  const combined = new Uint8Array(header.length + compressed.length)
  combined.set(header, 0)
  combined.set(new Uint8Array(compressed), header.length)

  return "0000" + base32hex(combined)
}
