import { notFound } from "next/navigation"
import { format } from "date-fns"
import { formatEur } from "@vexera/utils"

import { getInvoice } from "@/lib/data/invoices"
import { QrPaymentCode } from "@/components/invoices/qr-payment-code"
import { PrintControls } from "./print-controls"

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invoice = await getInvoice(id)

  if (!invoice) notFound()

  return (
    <>
      <PrintControls />

      <div className="invoice-page font-sans text-gray-900 bg-white p-12 max-w-[210mm] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            {invoice.organization?.logo_url && (
              <img
                src={invoice.organization.logo_url}
                alt="Company logo"
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
              <p className="text-lg font-mono text-gray-500 mt-1">{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="text-right space-y-1 text-sm">
            <p>
              <span className="text-gray-500">Type:</span>{" "}
              <span className="capitalize font-medium">{invoice.invoice_type}</span>
            </p>
            <p>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="font-medium capitalize">{invoice.status}</span>
            </p>
          </div>
        </div>

        {/* Supplier / Customer */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Supplier (Dodávateľ)
            </p>
            <p className="font-bold text-base">{invoice.supplier_name}</p>
            {invoice.supplier_ico && (
              <p className="text-sm text-gray-600">IČO: {invoice.supplier_ico}</p>
            )}
            {invoice.supplier_dic && (
              <p className="text-sm text-gray-600">DIČ: {invoice.supplier_dic}</p>
            )}
            {invoice.supplier_ic_dph && (
              <p className="text-sm text-gray-600">IČ DPH: {invoice.supplier_ic_dph}</p>
            )}
            {invoice.supplier_address && (
              <p className="text-sm text-gray-600">{invoice.supplier_address}</p>
            )}
            {invoice.supplier_iban && (
              <p className="text-sm font-mono text-gray-600">IBAN: {invoice.supplier_iban}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Customer (Odberateľ)
            </p>
            <p className="font-bold text-base">{invoice.customer_name}</p>
            {invoice.customer_ico && (
              <p className="text-sm text-gray-600">IČO: {invoice.customer_ico}</p>
            )}
            {invoice.customer_dic && (
              <p className="text-sm text-gray-600">DIČ: {invoice.customer_dic}</p>
            )}
            {invoice.customer_ic_dph && (
              <p className="text-sm text-gray-600">IČ DPH: {invoice.customer_ic_dph}</p>
            )}
            {invoice.customer_address && (
              <p className="text-sm text-gray-600">{invoice.customer_address}</p>
            )}
          </div>
        </div>

        {/* Dates + payment */}
        <div className="grid grid-cols-4 gap-4 mb-8 rounded-lg bg-gray-50 p-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Issue date</p>
            <p className="font-medium">{format(new Date(invoice.issue_date), "dd.MM.yyyy")}</p>
          </div>
          {invoice.delivery_date && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Delivery date</p>
              <p className="font-medium">
                {format(new Date(invoice.delivery_date), "dd.MM.yyyy")}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Due date</p>
            <p className="font-medium">{format(new Date(invoice.due_date), "dd.MM.yyyy")}</p>
          </div>
          {invoice.payment_method && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Payment</p>
              <p className="font-medium capitalize">
                {invoice.payment_method.replace("_", " ")}
              </p>
            </div>
          )}
          {invoice.variable_symbol && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Variable symbol</p>
              <p className="font-mono font-medium">{invoice.variable_symbol}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        <table className="w-full mb-6 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="pb-2 text-left font-semibold">Description</th>
              <th className="pb-2 text-right font-semibold">Qty</th>
              <th className="pb-2 text-right font-semibold">Unit price</th>
              <th className="pb-2 text-right font-semibold">VAT</th>
              <th className="pb-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.invoice_items ?? []).map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 text-right tabular-nums">
                  {item.quantity} {item.unit}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatEur(Number(item.unit_price))}
                </td>
                <td className="py-2 text-right">{item.vat_rate}%</td>
                <td className="py-2 text-right tabular-nums font-medium">
                  {formatEur(Number(item.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals with VAT breakdown */}
        {(() => {
          const items = invoice.invoice_items ?? []
          const vatMap = new Map<number, { net: number; vat: number }>()
          for (const item of items) {
            const rate = Number(item.vat_rate)
            const prev = vatMap.get(rate) ?? { net: 0, vat: 0 }
            prev.net += Number(item.quantity) * Number(item.unit_price)
            prev.vat += Number(item.vat_amount)
            vatMap.set(rate, prev)
          }
          const breakdown = Array.from(vatMap.entries()).sort((a, b) => b[0] - a[0])
          return (
            <div className="border-t border-gray-900 pt-4 ml-auto w-72 text-sm">
              {breakdown.length > 1 && (
                <table className="w-full mb-2">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left font-normal pb-1">VAT rate</th>
                      <th className="text-right font-normal pb-1">Net amount</th>
                      <th className="text-right font-normal pb-1">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map(([rate, { net, vat }]) => (
                      <tr key={rate} className="text-gray-600">
                        <td className="py-0.5">{rate}%</td>
                        <td className="py-0.5 text-right tabular-nums">{formatEur(net)}</td>
                        <td className="py-0.5 text-right tabular-nums">{formatEur(vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal (net)</span>
                  <span className="tabular-nums">{formatEur(Number(invoice.subtotal))}</span>
                </div>
                {breakdown.map(([rate, { vat }]) => (
                  <div key={rate} className="flex justify-between text-gray-500">
                    <span>VAT {rate}%</span>
                    <span className="tabular-nums">{formatEur(vat)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-bold border-t border-gray-900 pt-2">
                  <span>Total</span>
                  <span className="tabular-nums">{formatEur(Number(invoice.total))}</span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* QR payment code */}
        {invoice.invoice_type === "issued" && invoice.supplier_iban && (
          <div className="mt-6 flex items-start gap-4">
            <QrPaymentCode
              amount={Number(invoice.total)}
              currency={(invoice as any).currency || "EUR"}
              iban={invoice.supplier_iban}
              variableSymbol={invoice.variable_symbol ?? undefined}
              constantSymbol={invoice.constant_symbol ?? undefined}
              specificSymbol={(invoice as any).specific_symbol ?? undefined}
              dueDate={invoice.due_date}
              beneficiaryName={invoice.supplier_name}
              note={`Invoice ${invoice.invoice_number}`}
            />
            <div className="text-xs text-gray-500 space-y-0.5 pt-2">
              <p>Scan to pay via your banking app</p>
              <p className="font-mono">{invoice.supplier_iban}</p>
              {invoice.variable_symbol && <p>VS: {invoice.variable_symbol}</p>}
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Note
            </p>
            <p>{invoice.notes}</p>
          </div>
        )}

        {/* Signature line */}
        <div className="mt-16 grid grid-cols-2 gap-8 text-sm text-gray-500">
          <div className="border-t pt-4">Issued by (signature)</div>
          <div className="border-t pt-4">Received by (signature)</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .invoice-page { padding: 20mm; max-width: 100%; }
        }
      `}</style>
    </>
  )
}
