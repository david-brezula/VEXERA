"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import {
  Building2,
  MapPin,
  FileText,
  Landmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Mail,
  Upload,
  ArrowRight,
  Briefcase,
  Store,
  Calculator,
  Loader2,
  Users,
} from "lucide-react"

import type { OrganizationType } from "@vexera/types"
import { TeamStep } from "@/components/onboarding/team-step"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const step1SchemaBase = z.object({
  name: z.string().min(2, { message: "Nazov musi mat aspon 2 znaky" }),
  ico: z.string().optional(),
  dic: z.string().optional(),
  ic_dph: z.string().optional(),
  address_country: z.string().optional(),
  tax_regime: z.enum(["pausalne_vydavky", "naklady"]).optional(),
  dph_status: z.enum(["platca", "neplatca"]).optional(),
})

const step2Schema = z.object({
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  email: z
    .string()
    .email({ message: "Zadajte platnu emailovu adresu" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
})

type Step1Values = z.infer<typeof step1SchemaBase>
type Step2Values = z.infer<typeof step2Schema>

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "Typ organizacie", icon: Building2 },
  { id: 1, label: "Profil organizacie", icon: Building2 },
  { id: 2, label: "Kontakt a adresa", icon: MapPin },
  { id: 3, label: "Tim", icon: Users },
  { id: 4, label: "Dokumenty", icon: FileText },
  { id: 5, label: "Banka", icon: Landmark },
] as const

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Krok {currentStep + 1} z {STEPS.length} —{" "}
          <span className="text-foreground font-semibold">
            {STEPS[currentStep]?.label}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round((currentStep / STEPS.length) * 100)}% hotovo
        </p>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              currentStep > step.id
                ? "bg-primary"
                : currentStep === step.id
                  ? "bg-primary/60"
                  : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((step) => {
          const Icon = step.icon
          return (
            <div
              key={step.id}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 pt-1",
                currentStep === step.id
                  ? "text-primary"
                  : currentStep > step.id
                    ? "text-primary/70"
                    : "text-muted-foreground/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium hidden sm:block truncate text-center">
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 0: Organization Type Picker ─────────────────────────────────────────

const ORG_TYPE_OPTIONS: {
  type: OrganizationType
  label: string
  icon: typeof Briefcase
  bg: string
  color: string
  description: string
}[] = [
  {
    type: "freelancer",
    label: "Zivnostnik",
    icon: Briefcase,
    bg: "bg-blue-500/10",
    color: "text-blue-500",
    description:
      "SZCO, samostatne zarabajuca osoba. Moznost pausalnych vydavkov alebo skutocnych nakladov.",
  },
  {
    type: "company",
    label: "Firma",
    icon: Store,
    bg: "bg-violet-500/10",
    color: "text-violet-500",
    description:
      "s.r.o., a.s. alebo ina pravnicka osoba. Sprava DPH a firemneho ucetnictva.",
  },
  {
    type: "accounting_firm",
    label: "Uctovnik",
    icon: Calculator,
    bg: "bg-emerald-500/10",
    color: "text-emerald-500",
    description:
      "Uctovna firma alebo externy uctovnik. Sprava klientov a ich ucetnictva.",
  },
]

function OrgTypePicker({
  onSelect,
}: {
  onSelect: (type: OrganizationType) => void
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [loadingType, setLoadingType] = useState<OrganizationType | null>(null)

  async function handleSelect(type: OrganizationType) {
    if (!activeOrg) return
    setLoadingType(type)
    try {
      // Update organization_type on the org (may not be in generated types yet)
      const { error } = await (supabase
        .from("organizations")
        .update({ organization_type: type } as any)
        .eq("id", activeOrg.id) as any)

      if (error) throw error

      // For accounting firms, create the profile row
      if (type === "accounting_firm") {
        const { error: profileError } = await (supabase
          .from("accounting_firm_profiles") as any)
          .upsert(
            { organization_id: activeOrg.id },
            { onConflict: "organization_id" }
          )

        if (profileError) throw profileError
      }

      onSelect(type)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nepodarilo sa nastavit typ organizacie"
      toast.error(message)
    } finally {
      setLoadingType(null)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ORG_TYPE_OPTIONS.map((option) => {
        const Icon = option.icon
        const isLoading = loadingType === option.type
        return (
          <button
            key={option.type}
            type="button"
            disabled={loadingType !== null}
            onClick={() => handleSelect(option.type)}
            className={cn(
              "rounded-lg border p-6 space-y-3 text-left transition-all hover:border-primary hover:shadow-md cursor-pointer",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isLoading && "border-primary shadow-md"
            )}
          >
            <div className={cn("inline-flex rounded-md p-3", option.bg)}>
              {isLoading ? (
                <Loader2 className={cn("h-6 w-6 animate-spin", option.color)} />
              ) : (
                <Icon className={cn("h-6 w-6", option.color)} />
              )}
            </div>
            <h3 className="text-base font-semibold">{option.label}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {option.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 1: Organization Profile (type-aware) ───────────────────────────────

function Step1Form({
  onNext,
  orgName,
  orgType,
}: {
  onNext: () => void
  orgName: string
  orgType: OrganizationType
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1SchemaBase) as unknown as Resolver<Step1Values>,
    defaultValues: {
      name: orgName,
      ico: "",
      dic: "",
      ic_dph: "",
      address_country: "SK",
      tax_regime: orgType === "freelancer" ? "pausalne_vydavky" : undefined,
      dph_status: orgType === "company" ? "neplatca" : undefined,
    },
  })

  async function onSubmit(values: Step1Values) {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: values.name,
          ico: values.ico || undefined,
          dic: values.dic || null,
          ic_dph: values.ic_dph || null,
          address_country: values.address_country || "SK",
        })
        .eq("id", activeOrg.id)

      if (error) throw error

      // Upsert the type-specific profile row
      if (orgType === "freelancer") {
        const { error: profileError } = await (supabase
          .from("freelancer_profiles") as any)
          .upsert(
            {
              organization_id: activeOrg.id,
              tax_regime: values.tax_regime || "pausalne_vydavky",
            },
            { onConflict: "organization_id" }
          )

        if (profileError) throw profileError
      } else if (orgType === "company") {
        const { error: profileError } = await (supabase
          .from("company_profiles") as any)
          .upsert(
            {
              organization_id: activeOrg.id,
              dph_status: values.dph_status || "neplatca",
            },
            { onConflict: "organization_id" }
          )

        if (profileError) throw profileError
      }

      toast.success("Profil organizacie ulozeny")
      onNext()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nepodarilo sa ulozit profil organizacie"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nazov organizacie *</FormLabel>
              <FormControl>
                <Input placeholder="Acme s.r.o." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type-specific fields */}
        {orgType === "freelancer" && (
          <FormField
            control={form.control}
            name="tax_regime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Danovy rezim</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte danovy rezim" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pausalne_vydavky">
                      Pausalne vydavky
                    </SelectItem>
                    <SelectItem value="naklady">
                      Skutocne naklady
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Urcuje sposob uplatnovania vydavkov pri danovom priznani.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {orgType === "company" && (
          <FormField
            control={form.control}
            name="dph_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DPH status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte DPH status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="platca">Platca DPH</SelectItem>
                    <SelectItem value="neplatca">Neplatca DPH</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Urcuje, ci je vasa firma registrovana ako platca DPH.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="ico"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ICO</FormLabel>
                <FormControl>
                  <Input placeholder="12345678" maxLength={8} {...field} />
                </FormControl>
                <FormDescription>8-miestne ICO</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DIC</FormLabel>
                <FormControl>
                  <Input placeholder="1234567890" maxLength={10} {...field} />
                </FormControl>
                <FormDescription>Danove identifikacne cislo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Hide IC DPH for freelancers */}
          {orgType !== "freelancer" && (
            <FormField
              control={form.control}
              name="ic_dph"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IC DPH</FormLabel>
                  <FormControl>
                    <Input placeholder="SK1234567890" maxLength={12} {...field} />
                  </FormControl>
                  <FormDescription>Identifikacne cislo pre DPH</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="address_country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Krajina</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte krajinu" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SK">Slovensko</SelectItem>
                  <SelectItem value="CZ">Ceska republika</SelectItem>
                  <SelectItem value="AT">Rakusko</SelectItem>
                  <SelectItem value="HU">Madarsko</SelectItem>
                  <SelectItem value="PL">Polsko</SelectItem>
                  <SelectItem value="DE">Nemecko</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukladam..." : "Pokracovat"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 2: Contact & Address ────────────────────────────────────────────────

function Step2Form({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema) as unknown as Resolver<Step2Values>,
    defaultValues: {
      address_street: "",
      address_city: "",
      address_zip: "",
      email: "",
      phone: "",
    },
  })

  async function onSubmit(values: Step2Values) {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          address_street: values.address_street || null,
          address_city: values.address_city || null,
          address_zip: values.address_zip || null,
          email: values.email || null,
          phone: values.phone || null,
        })
        .eq("id", activeOrg.id)

      if (error) throw error
      toast.success("Kontaktne udaje ulozene")
      onNext()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nepodarilo sa ulozit kontaktne udaje"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="address_street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ulica a cislo</FormLabel>
              <FormControl>
                <Input placeholder="Hlavna 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="address_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mesto</FormLabel>
                <FormControl>
                  <Input placeholder="Bratislava" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PSC</FormLabel>
                <FormControl>
                  <Input placeholder="811 01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kontaktny email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="info@firma.sk"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefonne cislo</FormLabel>
                <FormControl>
                  <Input placeholder="+421 900 000 000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Spat
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukladam..." : "Pokracovat"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 3: Documents guidance ───────────────────────────────────────────────

function Step3Guidance({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const router = useRouter()

  function goToDocuments() {
    router.push("/documents")
  }

  const methods = [
    {
      icon: Upload,
      title: "Manualne nahratie",
      description:
        "Pretiahnte PDF, JPG alebo PNG subory priamo z vasho pocitaca.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Mail,
      title: "Gmail auto-import",
      description:
        "Pripojte svoj Gmail ucet a automaticky stiahneme faktury a blocky.",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      icon: ArrowRight,
      title: "Preposlanie emailom",
      description:
        "Preposielajte emaily s prilohami na vasu unikatnu Vexera emailovu adresu.",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {methods.map((method) => {
          const Icon = method.icon
          return (
            <div
              key={method.title}
              className="rounded-lg border p-4 space-y-2"
            >
              <div className={cn("inline-flex rounded-md p-2", method.bg)}>
                <Icon className={cn("h-5 w-5", method.color)} />
              </div>
              <h3 className="text-sm font-semibold">{method.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {method.description}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Spat
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onNext}
            className="text-muted-foreground"
          >
            Preskocit
          </Button>
          <Button type="button" onClick={goToDocuments}>
            <FileText className="h-4 w-4 mr-2" />
            Ist do Dokumentov
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Bank guidance ────────────────────────────────────────────────────

function Step4Guidance({
  onFinish,
  onBack,
}: {
  onFinish: () => void
  onBack: () => void
}) {
  const router = useRouter()

  function goToBank() {
    router.push("/bank?tab=import")
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-blue-500/10 p-3 flex-shrink-0">
            <Landmark className="h-6 w-6 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">Importujte bankovy vypis</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nahrajte bankovy vypis vo formate MT940 alebo CSV. Vexera
              automaticky sparuje transakcie s vasimi fakturami pomocou VS
              (variabilneho symbolu) a sumy.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["MT940", "CSV", "XML", "OFX"].map((format) => (
            <div
              key={format}
              className="rounded-md bg-muted px-3 py-2 text-center"
            >
              <span className="text-sm font-medium">{format}</span>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={goToBank}>
          <Landmark className="h-4 w-4 mr-2" />
          Ist do Bankoveho importu
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Spat
        </Button>
        <Button type="button" onClick={onFinish}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Dokoncit nastavenie
        </Button>
      </div>
    </div>
  )
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      <div className="rounded-full bg-green-500/10 p-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Vsetko je pripravene!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Vasa organizacia je nastavena a pripravena. Zacnite spravovat svoje
          uctovnictvo s Vexerou.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/invoices/new">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Vytvorit prvu fakturu
          </Button>
        </Link>
        <Button onClick={onDone}>
          Ist na Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter()
  const { activeOrg } = useOrganization()
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [orgType, setOrgType] = useState<OrganizationType | null>(null)

  function goNext() {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  function handleTypeSelected(type: OrganizationType) {
    setOrgType(type)
    goNext()
  }

  function handleFinish() {
    localStorage.setItem("onboarding_complete", "true")
    setIsComplete(true)
  }

  function handleDone() {
    router.push("/dashboard")
  }

  const stepTitles: Record<number, { title: string; description: string }> = {
    0: {
      title: "Typ organizacie",
      description: "Vyberte typ vasej organizacie, aby sme mohli prisposobit nastavenie.",
    },
    1: {
      title: "Profil organizacie",
      description: "Povedzte nam o vasej organizacii, aby faktury a dokumenty vyzerali profesionalne.",
    },
    2: {
      title: "Kontakt a adresa",
      description: "Pridajte kontaktne udaje a adresu sidla.",
    },
    3: {
      title: "Pozvite tim",
      description: "Pozvite clenov timu na spolupracu vo vasej organizacii.",
    },
    4: {
      title: "Nahrajte dokumenty",
      description: "Vyberte sposob importu faktur a blockov.",
    },
    5: {
      title: "Pripojte banku",
      description: "Importujte bankove vypisy pre automaticke parovanie transakcii.",
    },
  }

  const stepInfo = stepTitles[currentStep]

  if (isComplete) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <CompletionScreen onDone={handleDone} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressBar currentStep={currentStep} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{stepInfo?.title}</CardTitle>
          <CardDescription>{stepInfo?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <OrgTypePicker onSelect={handleTypeSelected} />
          )}
          {currentStep === 1 && orgType && (
            <Step1Form
              onNext={goNext}
              orgName={activeOrg?.name ?? ""}
              orgType={orgType}
            />
          )}
          {currentStep === 2 && (
            <Step2Form onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 3 && (
            <TeamStep onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 4 && (
            <Step3Guidance onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 5 && (
            <Step4Guidance onFinish={handleFinish} onBack={goBack} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
