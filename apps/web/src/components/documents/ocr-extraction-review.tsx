"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { OcrExtractedFields } from "@vexera/types"

import { createInvoiceFromOcrAction } from "@/lib/actions/ocr"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"

// ─── Confidence dot ──────────────────────────────────────────────────────────

function ConfidenceDot({ value }: { value: unknown }) {
  const hasValue = value !== null && value !== undefined && value !== ""
  return (
    <span
      className={`inline-block rounded-full size-2 ${hasValue ? "bg-green-500" : "bg-red-500"}`}
    />
  )
}

// ─── Field definitions ───────────────────────────────────────────────────────

type FieldKey = Exclude<keyof OcrExtractedFields, "raw_text">

interface FieldDef {
  key: FieldKey
  label: string
  type: "text" | "date" | "number"
  placeholder: string
  step?: string
}

const FIELDS: FieldDef[] = [
  { key: "supplier_name", label: "Supplier name", type: "text", placeholder: "Supplier name" },
  { key: "document_number", label: "Document number", type: "text", placeholder: "INV-001" },
  { key: "issue_date", label: "Issue date", type: "date", placeholder: "" },
  { key: "due_date", label: "Due date", type: "date", placeholder: "" },
  { key: "total_amount", label: "Total amount", type: "number", placeholder: "0.00", step: "0.01" },
  { key: "vat_amount", label: "VAT amount", type: "number", placeholder: "0.00", step: "0.01" },
  { key: "vat_rate", label: "VAT rate (%)", type: "number", placeholder: "20", step: "0.01" },
  { key: "currency", label: "Currency", type: "text", placeholder: "EUR" },
  { key: "iban", label: "IBAN", type: "text", placeholder: "SK..." },
  { key: "variable_symbol", label: "Variable symbol", type: "text", placeholder: "1234567890" },
]

// ─── OcrExtractionReview ─────────────────────────────────────────────────────

interface OcrExtractionReviewProps {
  documentId: string
  ocrData: OcrExtractedFields
  onInvoiceCreated?: (invoiceId: string) => void
}

export function OcrExtractionReview({
  documentId,
  ocrData,
  onInvoiceCreated,
}: OcrExtractionReviewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of FIELDS) {
      const raw = ocrData[field.key]
      initial[field.key] = raw != null ? String(raw) : ""
    }
    return initial as Record<FieldKey, string>
  })

  function handleChange(key: FieldKey, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  function handleAcceptAndCreate() {
    startTransition(async () => {
      const result = await createInvoiceFromOcrAction({
        documentId,
        supplierName: values.supplier_name,
        documentNumber: values.document_number || null,
        issueDate: values.issue_date || null,
        dueDate: values.due_date || null,
        totalAmount: values.total_amount ? parseFloat(values.total_amount) : null,
        vatAmount: values.vat_amount ? parseFloat(values.vat_amount) : null,
        vatRate: values.vat_rate ? parseFloat(values.vat_rate) : null,
        currency: values.currency || null,
        iban: values.iban || null,
        variableSymbol: values.variable_symbol || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.invoiceId) {
        toast.success("Invoice created from OCR data")
        onInvoiceCreated?.(result.invoiceId)
      }
    })
  }

  function handleEditInFullForm() {
    // Build an OcrExtractedFields-shaped object for prefill
    const prefill: OcrExtractedFields = {
      supplier_name: values.supplier_name || null,
      document_number: values.document_number || null,
      issue_date: values.issue_date || null,
      due_date: values.due_date || null,
      total_amount: values.total_amount ? parseFloat(values.total_amount) : null,
      vat_amount: values.vat_amount ? parseFloat(values.vat_amount) : null,
      vat_rate: values.vat_rate ? parseFloat(values.vat_rate) : null,
      currency: values.currency || null,
      iban: values.iban || null,
      variable_symbol: values.variable_symbol || null,
      raw_text: ocrData.raw_text,
    }
    sessionStorage.setItem("ocr-prefill", JSON.stringify(prefill))
    router.push("/invoices/new")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">OCR Extraction Review</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label htmlFor={`ocr-${field.key}`} className="text-xs flex items-center gap-1.5">
                <ConfidenceDot value={ocrData[field.key]} />
                {field.label}
              </Label>
              <Input
                id={`ocr-${field.key}`}
                type={field.type}
                step={field.step}
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={isPending}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleAcceptAndCreate} disabled={isPending}>
            {isPending ? "Creating..." : "Accept & Create Invoice"}
          </Button>
          <Button variant="outline" onClick={handleEditInFullForm} disabled={isPending}>
            Edit in Full Form
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
