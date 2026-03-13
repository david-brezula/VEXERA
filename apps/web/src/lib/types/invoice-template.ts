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
}
