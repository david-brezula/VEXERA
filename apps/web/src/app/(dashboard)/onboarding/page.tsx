"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Briefcase, Store, Calculator, Loader2 } from "lucide-react"

import type { OrganizationType } from "@vexera/types"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import {
  createOrganizationSchema,
  type CreateOrganizationFormValues,
} from "@/lib/validations/organization.schema"
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
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

// ─── Type picker (Step 0 for new users) ───────────────────────────────────────

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

function TypePicker({ onSelect }: { onSelect: (type: OrganizationType) => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Vitajte vo Vexere</CardTitle>
          <CardDescription>
            Vyberte typ vasej organizacie, aby sme mohli prisposobit nastavenie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {ORG_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => onSelect(option.type)}
                  className={cn(
                    "rounded-lg border p-6 space-y-3 text-left transition-all hover:border-primary hover:shadow-md cursor-pointer"
                  )}
                >
                  <div className={cn("inline-flex rounded-md p-3", option.bg)}>
                    <Icon className={cn("h-6 w-6", option.color)} />
                  </div>
                  <h3 className="text-base font-semibold">{option.label}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Create org form (shown after type is chosen) ─────────────────────────────

function CreateOrganizationForm({ orgType, onBack }: { orgType: OrganizationType; onBack: () => void }) {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      ico: "",
      dic: "",
      ic_dph: "",
      address_street: "",
      address_city: "",
      address_zip: "",
      address_country: "SK",
      email: "",
      phone: "",
      bank_iban: "",
      bank_swift: "",
    },
  })

  async function onSubmit(values: CreateOrganizationFormValues) {
    if (!user) return
    setIsLoading(true)

    try {
      // Ensure profile row exists before inserting org_members (FK: user_id → profiles.id).
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
        { onConflict: "id" }
      )
      if (profileError) throw new Error(`Profile setup failed: ${profileError.message}`)

      const orgId = crypto.randomUUID()

      // Create organization with the chosen type
      const { error: orgError } = await supabase
        .from("organizations")
        .insert({
          id: orgId,
          name: values.name,
          ico: values.ico,
          dic: values.dic || null,
          ic_dph: values.ic_dph || null,
          address_street: values.address_street || null,
          address_city: values.address_city || null,
          address_zip: values.address_zip || null,
          address_country: values.address_country,
          email: values.email || null,
          phone: values.phone || null,
          bank_iban: values.bank_iban || null,
          bank_swift: values.bank_swift || null,
          organization_type: orgType,
        } as any)

      if (orgError) throw orgError

      // Add current user as owner
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role: "owner",
        })

      if (memberError) throw memberError

      // Create the type-specific profile row
      if (orgType === "freelancer") {
        await (supabase.from("freelancer_profiles") as any).insert({
          organization_id: orgId,
          tax_regime: "pausalne_vydavky",
          registered_dph: false,
          is_first_year: false,
          has_social_insurance: false,
          is_disabled: false,
        })
      } else if (orgType === "company") {
        await (supabase.from("company_profiles") as any).insert({
          organization_id: orgId,
          dph_status: "neplatca",
        })
      } else if (orgType === "accounting_firm") {
        await (supabase.from("accounting_firm_profiles") as any).insert({
          organization_id: orgId,
        })
      }

      // Set active org cookie
      document.cookie = `active_organization_id=${encodeURIComponent(orgId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

      await queryClient.invalidateQueries({ queryKey: ["organizations"] })
      toast.success("Organizacia vytvorena!")
      router.push("/dashboard")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa vytvorit organizaciu"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const typeLabel = ORG_TYPE_OPTIONS.find((o) => o.type === orgType)?.label ?? ""

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Vytvorte organizaciu — {typeLabel}</CardTitle>
          <CardDescription>
            Zadajte udaje o vasej organizacii. Polia oznacene * su povinne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informacie o organizacii</h3>
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="ico"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ICO *</FormLabel>
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
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Adresa</h3>
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
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Bankove udaje</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bank_iban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input placeholder="SK31 1200 0000 1987 4263 7541" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_swift"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT/BIC</FormLabel>
                        <FormControl>
                          <Input placeholder="TATRSKBX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                  Spat
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Vytvaram..." : "Vytvorit organizaciu"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { activeOrg, isLoading } = useOrganization()
  const [selectedType, setSelectedType] = useState<OrganizationType | null>(null)

  if (isLoading) {
    return null
  }

  // If the user already has an org, show the setup wizard
  if (activeOrg) {
    return <OnboardingWizard />
  }

  // No org yet: first pick type, then create org
  if (!selectedType) {
    return <TypePicker onSelect={setSelectedType} />
  }

  return <CreateOrganizationForm orgType={selectedType} onBack={() => setSelectedType(null)} />
}
