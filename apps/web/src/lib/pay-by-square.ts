/**
 * PAY by square encoder — Slovak banking QR payment standard.
 *
 * Server-only: uses Node.js zlib for compression.
 * Called from a server action, not directly from client components.
 */

import { deflateRawSync } from "zlib"

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

export function encodePayBySquare(input: PayBySquareInput): string {
  const dataString = buildDataString(input)
  const dataBytes = Buffer.from(dataString, "utf-8")

  // Compress with deflate (raw, no header)
  const compressed = deflateRawSync(dataBytes, { level: 9 })

  // Prepend 2-byte big-endian uint16 of uncompressed length
  const uncompressedLen = dataBytes.length
  const header = Buffer.alloc(2)
  header.writeUInt16BE(uncompressedLen, 0)

  // Combine header + compressed data
  const combined = Buffer.concat([header, compressed])

  // Base32hex encode and prepend version header
  return "0000" + base32hex(new Uint8Array(combined))
}
