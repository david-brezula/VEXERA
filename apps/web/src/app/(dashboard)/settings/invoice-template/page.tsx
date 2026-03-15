"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  getInvoiceTemplateSettingsAction,
  updateInvoiceTemplateSettingsAction,
} from "@/lib/actions/invoice-template"
import { DEFAULT_TEMPLATE_SETTINGS, type InvoiceTemplateSettings } from "@/lib/types/invoice-template"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function InvoiceTemplatePage() {
  const [settings, setSettings] = useState<InvoiceTemplateSettings>(DEFAULT_TEMPLATE_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getInvoiceTemplateSettingsAction().then((data) => {
      setSettings(data)
      setIsLoading(false)
    })
  }, [])

  const update = useCallback(
    <K extends keyof InvoiceTemplateSettings>(key: K, value: InvoiceTemplateSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  async function handleSave() {
    setIsSaving(true)
    const result = await updateInvoiceTemplateSettingsAction(settings)
    setIsSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Template settings saved")
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoice Template</h1>
        <p className="text-muted-foreground">
          Customize the appearance of your invoice PDFs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings panel */}
        <div className="space-y-6">
          {/* Accent Color */}
          <Card>
            <CardHeader>
              <CardTitle>Accent Color</CardTitle>
              <CardDescription>
                Used for header accents, table borders, and dividers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-input"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {settings.accentColor}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Logo Position */}
          <Card>
            <CardHeader>
              <CardTitle>Logo Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {(["left", "center", "right"] as const).map((pos) => (
                  <label key={pos} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="logoPosition"
                      value={pos}
                      checked={settings.logoPosition === pos}
                      onChange={() => update("logoPosition", pos)}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{pos}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Font */}
          <Card>
            <CardHeader>
              <CardTitle>Font</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={settings.font}
                onValueChange={(v) => update("font", v as InvoiceTemplateSettings["font"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Helvetica)</SelectItem>
                  <SelectItem value="serif">Serif (Times Roman)</SelectItem>
                  <SelectItem value="modern">Modern (Courier)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Header Layout */}
          <Card>
            <CardHeader>
              <CardTitle>Header Layout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {([
                  { value: "side-by-side", label: "Side by side" },
                  { value: "stacked", label: "Stacked" },
                ] as const).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="headerLayout"
                      value={opt.value}
                      checked={settings.headerLayout === opt.value}
                      onChange={() => update("headerLayout", opt.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Toggle switches */}
          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription>
                Choose which sections to show on the invoice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: "showBankDetails", label: "Bank details (IBAN)" },
                { key: "showQrCode", label: "QR payment code" },
                { key: "showNotes", label: "Notes section" },
                { key: "showSignatureLines", label: "Signature lines" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={settings[key]}
                    onCheckedChange={(v) => update(key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Footer Text */}
          <Card>
            <CardHeader>
              <CardTitle>Footer Text</CardTitle>
              <CardDescription>
                Optional text displayed at the bottom of every invoice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.footerText}
                onChange={(e) => update("footerText", e.target.value)}
                placeholder="e.g. Thank you for your business!"
                rows={3}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Simplified preview of your invoice layout.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white text-xs space-y-3 min-h-[400px]">
                {/* Preview header */}
                <div
                  className={`flex gap-3 pb-2 border-b-2 ${
                    settings.headerLayout === "stacked" ? "flex-col" : "flex-row justify-between"
                  }`}
                  style={{ borderBottomColor: settings.accentColor }}
                >
                  <div
                    className={`flex items-center gap-2 ${
                      settings.logoPosition === "center"
                        ? "justify-center"
                        : settings.logoPosition === "right"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: settings.accentColor }}
                    >
                      Logo
                    </div>
                    <div>
                      <div
                        className="font-bold text-sm"
                        style={{
                          fontFamily:
                            settings.font === "serif"
                              ? "Georgia, serif"
                              : settings.font === "modern"
                              ? "'Courier New', monospace"
                              : "system-ui, sans-serif",
                        }}
                      >
                        INVOICE
                      </div>
                      <div className="text-muted-foreground text-[10px]">2026-001</div>
                    </div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>Type: Regular</div>
                    <div>Status: Draft</div>
                  </div>
                </div>

                {/* Preview parties */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Supplier
                    </div>
                    <div className="font-semibold">Company s.r.o.</div>
                    {settings.showBankDetails && (
                      <div className="text-muted-foreground font-mono text-[10px]">
                        IBAN: SK00 0000 0000 0000
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Customer
                    </div>
                    <div className="font-semibold">Client a.s.</div>
                  </div>
                </div>

                {/* Preview table */}
                <div>
                  <div
                    className="flex justify-between font-semibold pb-1 border-b-2 text-[10px]"
                    style={{ borderBottomColor: settings.accentColor }}
                  >
                    <span>Description</span>
                    <span>Total</span>
                  </div>
                  <div className="flex justify-between py-1 text-[10px]">
                    <span>Web development</span>
                    <span>1 200,00 EUR</span>
                  </div>
                  <div className="flex justify-between py-1 text-[10px] bg-gray-50">
                    <span>Consulting</span>
                    <span>800,00 EUR</span>
                  </div>
                </div>

                {/* Preview total */}
                <div
                  className="text-right font-bold border-t pt-1"
                  style={{ borderTopColor: settings.accentColor }}
                >
                  Total: 2 000,00 EUR
                </div>

                {/* Preview notes */}
                {settings.showNotes && (
                  <div className="border rounded p-2 text-[10px] text-muted-foreground">
                    <div className="text-[9px] uppercase tracking-wider font-semibold mb-1">
                      Note
                    </div>
                    Sample note text
                  </div>
                )}

                {/* Preview QR */}
                {settings.showQrCode && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                      PAY by square
                    </div>
                    <div className="w-12 h-12 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center text-[8px] text-muted-foreground">
                      QR
                    </div>
                  </div>
                )}

                {/* Preview signatures */}
                {settings.showSignatureLines && (
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="border-t pt-1 text-[10px] text-muted-foreground">
                      Issued by
                    </div>
                    <div className="border-t pt-1 text-[10px] text-muted-foreground">
                      Received by
                    </div>
                  </div>
                )}

                {/* Preview footer */}
                {settings.footerText && (
                  <div
                    className="text-center text-[9px] pt-2 border-t"
                    style={{ borderTopColor: settings.accentColor, color: settings.accentColor }}
                  >
                    {settings.footerText}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
