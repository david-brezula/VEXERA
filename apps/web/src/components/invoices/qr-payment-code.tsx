"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { encodePayBySquare, type PayBySquareInput } from "@/lib/pay-by-square"

interface QrPaymentCodeProps {
  amount: number
  currency: string
  iban: string
  variableSymbol?: string
  constantSymbol?: string
  specificSymbol?: string
  dueDate?: string
  beneficiaryName?: string
  note?: string
}

export function QrPaymentCode(props: QrPaymentCodeProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const input: PayBySquareInput = {
          amount: props.amount,
          currencyCode: props.currency,
          iban: props.iban.replace(/\s/g, ""),
          variableSymbol: props.variableSymbol || undefined,
          constantSymbol: props.constantSymbol || undefined,
          specificSymbol: props.specificSymbol || undefined,
          dueDate: props.dueDate ? props.dueDate.replace(/-/g, "") : undefined,
          beneficiaryName: props.beneficiaryName || undefined,
          note: props.note || undefined,
        }
        const encoded = await encodePayBySquare(input)
        const svg = await QRCode.toString(encoded, { type: "svg", width: 160, margin: 1, errorCorrectionLevel: "M" })
        if (!cancelled) setSvgHtml(svg)
      } catch (err) {
        console.error("[QrPaymentCode] Generation failed:", err)
        if (!cancelled) setError(true)
      }
    }
    generate()
    return () => { cancelled = true }
  }, [props.amount, props.currency, props.iban, props.variableSymbol, props.constantSymbol, props.specificSymbol, props.dueDate, props.beneficiaryName, props.note])

  if (error || !props.iban) return null
  if (!svgHtml) return <div className="w-40 h-40 bg-gray-100 animate-pulse rounded" />

  return (
    <div className="space-y-1">
      <div dangerouslySetInnerHTML={{ __html: svgHtml }} className="w-40 h-40" />
      <p className="text-[10px] text-gray-400 text-center">PAY by square</p>
    </div>
  )
}
