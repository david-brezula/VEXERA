"use server"

import { encodePayBySquare, type PayBySquareInput } from "@/lib/pay-by-square"

export async function encodePayBySquareAction(
  input: PayBySquareInput
): Promise<string> {
  return encodePayBySquare(input)
}
