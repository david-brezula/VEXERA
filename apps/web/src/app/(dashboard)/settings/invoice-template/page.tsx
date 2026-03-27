"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  getInvoiceTemplateSettingsAction,
  updateInvoiceTemplateSettingsAction,
} from "@/features/invoices/actions-template"
import { DEFAULT_TEMPLATE_SETTINGS, type InvoiceTemplateSettings, type InvoiceNumberingFormat } from "@/features/invoices/types"
import { formatInvoiceNumber } from "@/lib/utils/invoice-number"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Switch } from "@/shared/components/ui/switch"
import { Textarea } from "@/shared/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"

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

  const updateNumbering = useCallback(
    <K extends keyof InvoiceNumberingFormat>(key: K, value: InvoiceNumberingFormat[K]) => {
      setSettings((prev) => ({
        ...prev,
        numberingFormat: { ...prev.numberingFormat, [key]: value },
      }))
    },
    []
  )

  const updateTypePrefix = useCallback(
    (type: "issued" | "received" | "credit_note", value: string) => {
      setSettings((prev) => ({
        ...prev,
        numberingFormat: {
          ...prev.numberingFormat,
          typePrefixes: {
            ...prev.numberingFormat.typePrefixes,
            [type]: value,
          },
        },
      }))
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
      toast.success("Nastavenia šablóny uložené")
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-muted-foreground">Načítavam...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Šablóna faktúry</h1>
        <p className="text-muted-foreground">
          Prispôsobte vzhľad vašich faktúr v PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings panel */}
        <div className="space-y-6">
          {/* Accent Color */}
          <Card>
            <CardHeader>
              <CardTitle>Farba zvýraznenia</CardTitle>
              <CardDescription>
                Používa sa pre zvýraznenie hlavičky, okraje tabuliek a oddeľovače.
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
              <CardTitle>Pozícia loga</CardTitle>
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
              <CardTitle>Písmo</CardTitle>
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
                  <SelectItem value="default">Predvolené (Helvetica)</SelectItem>
                  <SelectItem value="serif">Pätkové (Times Roman)</SelectItem>
                  <SelectItem value="modern">Moderné (Courier)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Header Layout */}
          <Card>
            <CardHeader>
              <CardTitle>Rozloženie hlavičky</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {([
                  { value: "side-by-side", label: "Vedľa seba" },
                  { value: "stacked", label: "Pod sebou" },
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
              <CardTitle>Sekcie</CardTitle>
              <CardDescription>
                Vyberte, ktoré sekcie zobraziť na faktúre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: "showBankDetails", label: "Bankové údaje (IBAN)" },
                { key: "showQrCode", label: "QR platobný kód" },
                { key: "showNotes", label: "Sekcia poznámok" },
                { key: "showSignatureLines", label: "Podpisové riadky" },
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
              <CardTitle>Text päty</CardTitle>
              <CardDescription>
                Voliteľný text zobrazený v spodnej časti každej faktúry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.footerText}
                onChange={(e) => update("footerText", e.target.value)}
                placeholder="napr. Ďakujeme za spoluprácu!"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Invoice Numbering Format */}
          <Card>
            <CardHeader>
              <CardTitle>Formát číslovania faktúr</CardTitle>
              <CardDescription>
                Nastavte formát automatického číslovania. Zmeny sa prejavia len na nových faktúrach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prefix</Label>
                  <Input
                    value={settings.numberingFormat.prefix}
                    onChange={(e) => updateNumbering("prefix", e.target.value)}
                    placeholder="napr. FV"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Oddeľovač</Label>
                  <Select
                    value={settings.numberingFormat.separator || "none"}
                    onValueChange={(v) => updateNumbering("separator", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Pomlčka (-)</SelectItem>
                      <SelectItem value="/">Lomka (/)</SelectItem>
                      <SelectItem value="none">Žiadny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formát roku</Label>
                  <Select
                    value={settings.numberingFormat.yearFormat}
                    onValueChange={(v) =>
                      updateNumbering("yearFormat", v as InvoiceNumberingFormat["yearFormat"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Plný (2026)</SelectItem>
                      <SelectItem value="short">Krátky (26)</SelectItem>
                      <SelectItem value="none">Bez roku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Počet číslic</Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.numberingFormat.padding}
                    onChange={(e) =>
                      updateNumbering("padding", Math.max(1, Math.min(6, parseInt(e.target.value) || 3)))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="includeType">Rôzne prefixy podľa typu faktúry</Label>
                <Switch
                  id="includeType"
                  checked={settings.numberingFormat.includeType}
                  onCheckedChange={(v) => updateNumbering("includeType", v)}
                />
              </div>

              {settings.numberingFormat.includeType && (
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { type: "issued" as const, label: "Vydaná" },
                    { type: "received" as const, label: "Prijatá" },
                    { type: "credit_note" as const, label: "Dobropis" },
                  ]).map(({ type, label }) => (
                    <div key={type} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={settings.numberingFormat.typePrefixes?.[type] ?? ""}
                        onChange={(e) => updateTypePrefix(type, e.target.value)}
                        placeholder={type === "issued" ? "FV" : type === "received" ? "PF" : "DN"}
                        maxLength={10}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Live preview */}
              <div className="rounded-md border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Náhľad:</div>
                <div className="font-mono text-sm font-medium">
                  {formatInvoiceNumber(settings.numberingFormat, "issued", 1)}
                </div>
                {settings.numberingFormat.includeType && (
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground font-mono">
                    <div>Vydaná: {formatInvoiceNumber(settings.numberingFormat, "issued", 1)}</div>
                    <div>Prijatá: {formatInvoiceNumber(settings.numberingFormat, "received", 1)}</div>
                    <div>Dobropis: {formatInvoiceNumber(settings.numberingFormat, "credit_note", 1)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Ukladám..." : "Uložiť nastavenia"}
          </Button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Náhľad</CardTitle>
              <CardDescription>Zjednodušený náhľad rozloženia faktúry.</CardDescription>
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
                        FAKTÚRA
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {formatInvoiceNumber(settings.numberingFormat, "issued", 1)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>Typ: Bežná</div>
                    <div>Stav: Koncept</div>
                  </div>
                </div>

                {/* Preview parties */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Dodávateľ
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
                      Odberateľ
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
                    <span>Popis</span>
                    <span>Spolu</span>
                  </div>
                  <div className="flex justify-between py-1 text-[10px]">
                    <span>Vývoj webstránok</span>
                    <span>1 200,00 EUR</span>
                  </div>
                  <div className="flex justify-between py-1 text-[10px] bg-gray-50">
                    <span>Konzultácie</span>
                    <span>800,00 EUR</span>
                  </div>
                </div>

                {/* Preview total */}
                <div
                  className="text-right font-bold border-t pt-1"
                  style={{ borderTopColor: settings.accentColor }}
                >
                  Spolu: 2 000,00 EUR
                </div>

                {/* Preview notes */}
                {settings.showNotes && (
                  <div className="border rounded p-2 text-[10px] text-muted-foreground">
                    <div className="text-[9px] uppercase tracking-wider font-semibold mb-1">
                      Poznámka
                    </div>
                    Ukážkový text poznámky
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
                      Vystavil
                    </div>
                    <div className="border-t pt-1 text-[10px] text-muted-foreground">
                      Prevzal
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
