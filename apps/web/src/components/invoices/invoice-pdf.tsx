import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { InvoiceDetail } from "@/lib/data/invoices"
import type { InvoiceTemplateSettings } from "@/lib/types/invoice-template"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(n)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#111827",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.5,
  },
  invoiceNumber: {
    fontSize: 12,
    fontFamily: "Courier",
    color: "#6b7280",
    marginTop: 4,
  },
  headerRight: {
    textAlign: "right",
    fontSize: 9,
  },
  headerLabel: {
    color: "#6b7280",
  },
  headerValue: {
    fontFamily: "Helvetica-Bold",
  },
  // Parties
  partiesRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 20,
  },
  partyCol: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#9ca3af",
    marginBottom: 6,
  },
  partyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 1,
  },
  partyMono: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#4b5563",
    marginBottom: 1,
  },
  // Dates row
  datesRow: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
    gap: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 3,
  },
  dateValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    backgroundColor: "#f9fafb",
  },
  thDesc: { flex: 3, fontFamily: "Helvetica-Bold", fontSize: 9 },
  thQty: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" },
  thPrice: { flex: 1.2, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" },
  thVat: { flex: 0.8, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" },
  thTotal: { flex: 1.2, fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" },
  tdDesc: { flex: 3, fontSize: 9 },
  tdQty: { flex: 1, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  tdPrice: { flex: 1.2, fontSize: 9, textAlign: "right", fontFamily: "Courier" },
  tdVat: { flex: 0.8, fontSize: 9, textAlign: "right" },
  tdTotal: { flex: 1.2, fontSize: 9, textAlign: "right", fontFamily: "Courier-Bold" },
  // Totals
  totalsContainer: {
    marginLeft: "auto",
    width: 200,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  totalsValue: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#6b7280",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 6,
    marginTop: 4,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  totalsFinalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  // VAT breakdown table
  vatBreakdownHeader: {
    flexDirection: "row",
    marginBottom: 2,
  },
  vatBreakdownRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  vatBkCol1: { flex: 1, fontSize: 7, color: "#6b7280" },
  vatBkCol2: { flex: 1, fontSize: 7, color: "#6b7280", textAlign: "right" },
  vatBkCol3: { flex: 1, fontSize: 7, color: "#6b7280", textAlign: "right" },
  vatBkVal1: { flex: 1, fontSize: 8, color: "#4b5563" },
  vatBkVal2: { flex: 1, fontSize: 8, color: "#4b5563", textAlign: "right", fontFamily: "Courier" },
  vatBkVal3: { flex: 1, fontSize: 8, color: "#4b5563", textAlign: "right", fontFamily: "Courier" },
  // Notes
  notesContainer: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 10,
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#9ca3af",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#374151",
  },
  // Signatures
  signaturesRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 50,
  },
  signatureCol: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
  },
  signatureLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  // Logo
  logo: {
    width: 60,
    height: 60,
    objectFit: "contain" as const,
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  // QR payment
  qrSection: {
    marginTop: 20,
    alignItems: "center" as const,
  },
  qrLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "#6b7280",
    marginBottom: 6,
  },
  qrImage: {
    width: 100,
    height: 100,
  },
})

const FONT_MAP: Record<string, { regular: string; bold: string }> = {
  default: { regular: "Helvetica", bold: "Helvetica-Bold" },
  serif: { regular: "Times-Roman", bold: "Times-Bold" },
  modern: { regular: "Courier", bold: "Courier-Bold" },
}

const LOGO_ALIGNMENT: Record<string, "flex-start" | "center" | "flex-end"> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
}

export function InvoicePdfDocument({
  invoice,
  qrDataUrl,
  templateSettings,
}: {
  invoice: InvoiceDetail
  qrDataUrl?: string
  templateSettings?: InvoiceTemplateSettings
}) {
  const items = invoice.invoice_items ?? []
  const ts = templateSettings

  // Resolved fonts
  const fontRegular = ts ? FONT_MAP[ts.font]?.regular ?? "Helvetica" : "Helvetica"
  const fontBold = ts ? FONT_MAP[ts.font]?.bold ?? "Helvetica-Bold" : "Helvetica-Bold"
  const accent = ts?.accentColor ?? "#111827"

  // Conditionals driven by template settings (default to true when no settings)
  const showBankDetails = ts?.showBankDetails ?? true
  const showQrCode = ts?.showQrCode ?? true
  const showNotes = ts?.showNotes ?? true
  const showSignatureLines = ts?.showSignatureLines ?? true
  const headerDirection = ts?.headerLayout === "stacked" ? "column" as const : "row" as const
  const logoAlign = ts ? LOGO_ALIGNMENT[ts.logoPosition] ?? "flex-start" : "flex-start"

  // VAT breakdown
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
    <Document>
      <Page size="A4" style={{ ...s.page, fontFamily: fontRegular }}>
        {/* Header */}
        <View style={{ ...s.header, flexDirection: headerDirection }}>
          <View style={{ ...s.headerLeft, justifyContent: logoAlign }}>
            {invoice.organization?.logo_url && (
              <Image src={invoice.organization.logo_url} style={s.logo} />
            )}
            <View>
              <Text style={{ ...s.title, fontFamily: fontBold }}>INVOICE</Text>
              <Text style={s.invoiceNumber}>{invoice.invoice_number}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text>
              <Text style={s.headerLabel}>Type: </Text>
              <Text style={{ ...s.headerValue, fontFamily: fontBold }}>{invoice.invoice_type}</Text>
            </Text>
            <Text>
              <Text style={s.headerLabel}>Status: </Text>
              <Text style={{ ...s.headerValue, fontFamily: fontBold }}>{invoice.status}</Text>
            </Text>
          </View>
        </View>

        {/* Supplier / Customer */}
        <View style={s.partiesRow}>
          <View style={s.partyCol}>
            <Text style={{ ...s.partyLabel, fontFamily: fontBold }}>Supplier (Dodavatel)</Text>
            <Text style={{ ...s.partyName, fontFamily: fontBold }}>{invoice.supplier_name}</Text>
            {invoice.supplier_ico && <Text style={s.partyDetail}>ICO: {invoice.supplier_ico}</Text>}
            {invoice.supplier_dic && <Text style={s.partyDetail}>DIC: {invoice.supplier_dic}</Text>}
            {invoice.supplier_ic_dph && <Text style={s.partyDetail}>IC DPH: {invoice.supplier_ic_dph}</Text>}
            {invoice.supplier_address && <Text style={s.partyDetail}>{invoice.supplier_address}</Text>}
            {showBankDetails && invoice.supplier_iban && <Text style={s.partyMono}>IBAN: {invoice.supplier_iban}</Text>}
          </View>
          <View style={s.partyCol}>
            <Text style={{ ...s.partyLabel, fontFamily: fontBold }}>Customer (Odberatel)</Text>
            <Text style={{ ...s.partyName, fontFamily: fontBold }}>{invoice.customer_name}</Text>
            {invoice.customer_ico && <Text style={s.partyDetail}>ICO: {invoice.customer_ico}</Text>}
            {invoice.customer_dic && <Text style={s.partyDetail}>DIC: {invoice.customer_dic}</Text>}
            {invoice.customer_ic_dph && <Text style={s.partyDetail}>IC DPH: {invoice.customer_ic_dph}</Text>}
            {invoice.customer_address && <Text style={s.partyDetail}>{invoice.customer_address}</Text>}
          </View>
        </View>

        {/* Dates */}
        <View style={s.datesRow}>
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Issue date</Text>
            <Text style={{ ...s.dateValue, fontFamily: fontBold }}>{fmtDate(invoice.issue_date)}</Text>
          </View>
          {invoice.delivery_date && (
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Delivery date</Text>
              <Text style={{ ...s.dateValue, fontFamily: fontBold }}>{fmtDate(invoice.delivery_date)}</Text>
            </View>
          )}
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Due date</Text>
            <Text style={{ ...s.dateValue, fontFamily: fontBold }}>{fmtDate(invoice.due_date)}</Text>
          </View>
          {invoice.payment_method && (
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Payment</Text>
              <Text style={{ ...s.dateValue, fontFamily: fontBold }}>{invoice.payment_method.replace("_", " ")}</Text>
            </View>
          )}
          {invoice.variable_symbol && (
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Variable symbol</Text>
              <Text style={{ ...s.dateValue, fontFamily: fontBold }}>{invoice.variable_symbol}</Text>
            </View>
          )}
        </View>

        {/* Line items table */}
        <View style={{ ...s.tableHeader, borderBottomColor: accent }}>
          <Text style={{ ...s.thDesc, fontFamily: fontBold }}>Description</Text>
          <Text style={{ ...s.thQty, fontFamily: fontBold }}>Qty</Text>
          <Text style={{ ...s.thPrice, fontFamily: fontBold }}>Unit price</Text>
          <Text style={{ ...s.thVat, fontFamily: fontBold }}>VAT</Text>
          <Text style={{ ...s.thTotal, fontFamily: fontBold }}>Total</Text>
        </View>
        {items.map((item, i) => (
          <View key={item.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={s.tdDesc}>{item.description}</Text>
            <Text style={s.tdQty}>{item.quantity} {item.unit ?? ""}</Text>
            <Text style={s.tdPrice}>{fmtEur(Number(item.unit_price))}</Text>
            <Text style={s.tdVat}>{item.vat_rate}%</Text>
            <Text style={s.tdTotal}>{fmtEur(Number(item.total))}</Text>
          </View>
        ))}

        {/* Totals with VAT breakdown */}
        <View style={{ ...s.totalsContainer, borderTopColor: accent }}>
          {breakdown.length > 1 && (
            <View style={{ marginBottom: 6 }}>
              <View style={s.vatBreakdownHeader}>
                <Text style={s.vatBkCol1}>VAT rate</Text>
                <Text style={s.vatBkCol2}>Net amount</Text>
                <Text style={s.vatBkCol3}>VAT</Text>
              </View>
              {breakdown.map(([rate, { net, vat }]) => (
                <View key={rate} style={s.vatBreakdownRow}>
                  <Text style={s.vatBkVal1}>{rate}%</Text>
                  <Text style={s.vatBkVal2}>{fmtEur(net)}</Text>
                  <Text style={s.vatBkVal3}>{fmtEur(vat)}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal (net)</Text>
            <Text style={s.totalsValue}>{fmtEur(Number(invoice.subtotal))}</Text>
          </View>
          {breakdown.map(([rate, { vat }]) => (
            <View key={rate} style={s.totalsRow}>
              <Text style={s.totalsLabel}>VAT {rate}%</Text>
              <Text style={s.totalsValue}>{fmtEur(vat)}</Text>
            </View>
          ))}
          <View style={{ ...s.totalsFinalRow, borderTopColor: accent }}>
            <Text style={{ ...s.totalsFinalLabel, fontFamily: fontBold }}>Total</Text>
            <Text style={{ ...s.totalsFinalValue, fontFamily: fontBold }}>{fmtEur(Number(invoice.total))}</Text>
          </View>
        </View>

        {/* Notes */}
        {showNotes && invoice.notes && (
          <View style={s.notesContainer}>
            <Text style={{ ...s.notesLabel, fontFamily: fontBold }}>Note</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* PAY by square QR code */}
        {showQrCode && qrDataUrl && (
          <View style={s.qrSection}>
            <Text style={{ ...s.qrLabel, fontFamily: fontBold }}>PAY by square</Text>
            <Image src={qrDataUrl} style={s.qrImage} />
          </View>
        )}

        {/* Signature lines */}
        {showSignatureLines && (
          <View style={s.signaturesRow}>
            <View style={s.signatureCol}>
              <Text style={s.signatureLabel}>Issued by (signature)</Text>
            </View>
            <View style={s.signatureCol}>
              <Text style={s.signatureLabel}>Received by (signature)</Text>
            </View>
          </View>
        )}

        {/* Footer text */}
        {ts?.footerText ? (
          <View style={{ marginTop: 20, alignItems: "center" as const }}>
            <Text style={{ fontSize: 8, color: accent }}>{ts.footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}
