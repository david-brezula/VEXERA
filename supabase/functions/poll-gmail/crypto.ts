/**
 * AES-256-GCM encryption/decryption using Web Crypto API (works in Deno).
 * Compatible with the Node.js crypto.ts in apps/web/src/lib/crypto.ts.
 *
 * Format: base64(iv[12] + tag[16] + ciphertext)
 */

const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Uint8Array {
  const hex = Deno.env.get("ENCRYPTION_KEY")
  if (!hex) throw new Error("ENCRYPTION_KEY environment variable is required")
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", getKey(), { name: "AES-GCM" }, false, [
    "decrypt",
  ])
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await importKey()
  const buf = base64ToBytes(encoded)
  const iv = buf.subarray(0, IV_LENGTH)
  // Web Crypto expects ciphertext + tag concatenated (tag appended)
  const ciphertextWithTag = new Uint8Array(buf.length - IV_LENGTH)
  // Rearrange: our format is iv + tag + ciphertext, but Web Crypto wants iv + (ciphertext + tag)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  ciphertextWithTag.set(ciphertext, 0)
  ciphertextWithTag.set(tag, ciphertext.length)

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH * 8 },
    key,
    ciphertextWithTag
  )
  return new TextDecoder().decode(plainBuf)
}
