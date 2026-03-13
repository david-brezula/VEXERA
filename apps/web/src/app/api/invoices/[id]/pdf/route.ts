import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import QRCode from "qrcode"
import { getInvoice } from "@/lib/data/invoices"
import { InvoicePdfDocument } from "@/components/invoices/invoice-pdf"
import { encodePayBySquare } from "@/lib/pay-by-square"
import { getInvoiceTemplateSettingsAction, type InvoiceTemplateSettings } from "@/lib/actions/invoice-template"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await getInvoice(id)
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }
    // Pre-compute PAY by square QR code if IBAN is available
    let qrDataUrl: string | undefined
    const iban = invoice.bank_iban || invoice.supplier_iban
    if (iban) {
      const payData = encodePayBySquare({
        amount: Number(invoice.total),
        currencyCode: invoice.currency || "EUR",
        iban,
        variableSymbol: invoice.variable_symbol ?? undefined,
        constantSymbol: invoice.constant_symbol ?? undefined,
        specificSymbol: invoice.specific_symbol ?? undefined,
        beneficiaryName: invoice.supplier_name ?? undefined,
        dueDate: invoice.due_date
          ? invoice.due_date.replace(/-/g, "")
          : undefined,
      })
      qrDataUrl = await QRCode.toDataURL(payData, { width: 150, margin: 1 })
    }

    // Fetch template settings for the organization
    let templateSettings: InvoiceTemplateSettings | undefined
    try {
      templateSettings = await getInvoiceTemplateSettingsAction()
    } catch {
      // Continue without template settings if fetch fails
    }

    const element = createElement(InvoicePdfDocument, { invoice, qrDataUrl, templateSettings })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)
    const filename = `invoice-${invoice.invoice_number}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
