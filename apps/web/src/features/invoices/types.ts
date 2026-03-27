export interface InvoiceNumberingFormat {
  prefix: string
  separator: string
  yearFormat: "full" | "short" | "none"
  padding: number
  includeType: boolean
  typePrefixes?: {
    issued?: string
    received?: string
    credit_note?: string
  }
}

export interface InvoiceTemplateSettings {
  logoPosition: "left" | "center" | "right"
  accentColor: string
  font: "default" | "serif" | "modern"
  footerText: string
  showBankDetails: boolean
  showQrCode: boolean
  showNotes: boolean
  showSignatureLines: boolean
  headerLayout: "side-by-side" | "stacked"
  numberingFormat: InvoiceNumberingFormat
}

export const DEFAULT_NUMBERING_FORMAT: InvoiceNumberingFormat = {
  prefix: "",
  separator: "-",
  yearFormat: "full",
  padding: 3,
  includeType: false,
}

export const DEFAULT_TEMPLATE_SETTINGS: InvoiceTemplateSettings = {
  logoPosition: "left",
  accentColor: "#111111",
  font: "default",
  footerText: "",
  showBankDetails: true,
  showQrCode: true,
  showNotes: true,
  showSignatureLines: true,
  headerLayout: "side-by-side",
  numberingFormat: DEFAULT_NUMBERING_FORMAT,
}
