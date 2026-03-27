"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { useCurrentMemberRole } from "@/shared/hooks/use-current-member-role"
import {
  createOrganizationSchema,
  type CreateOrganizationFormValues,
} from "@/features/settings/schemas"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { EmailConnection } from "@/features/settings/components/email-connection"

export default function SettingsPage() {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const { isAdmin } = useCurrentMemberRole()
  const [isLoading, setIsLoading] = useState(false)
  const [vatFilingFrequency, setVatFilingFrequency] = useState<string>("quarterly")

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

  useEffect(() => {
    if (activeOrg) {
      form.reset({
        name: activeOrg.name,
        ico: activeOrg.ico,
        dic: activeOrg.dic ?? "",
        ic_dph: activeOrg.ic_dph ?? "",
        address_street: "",
        address_city: "",
        address_zip: "",
        address_country: "SK",
        email: "",
        phone: "",
        bank_iban: "",
        bank_swift: "",
      })

      // Fetch full org data
      supabase
        .from("organizations")
        .select("name, ico, dic, ic_dph, address_street, address_city, address_zip, address_country, email, phone, bank_iban, bank_swift, filing_frequency")
        .eq("id", activeOrg.id)
        .single()
        .then(({ data }) => {
          if (data) {
            form.reset({
              name: data.name,
              ico: data.ico,
              dic: data.dic ?? "",
              ic_dph: data.ic_dph ?? "",
              address_street: data.address_street ?? "",
              address_city: data.address_city ?? "",
              address_zip: data.address_zip ?? "",
              address_country: data.address_country ?? "SK",
              email: data.email ?? "",
              phone: data.phone ?? "",
              bank_iban: data.bank_iban ?? "",
              bank_swift: data.bank_swift ?? "",
            })
            setVatFilingFrequency(data.filing_frequency ?? "quarterly")
          }
        })
    }
  }, [activeOrg, supabase, form])

  async function onSubmit(values: CreateOrganizationFormValues) {
    if (!activeOrg) return
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
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
          vat_filing_frequency: values.ic_dph ? vatFilingFrequency : null,
        })
        .eq("id", activeOrg.id)

      if (error) throw error
      toast.success("Organizácia aktualizovaná")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa aktualizovať"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeOrg) {
    return <p className="text-muted-foreground">Nie je vybraná organizácia.</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nastavenia</h1>
        <p className="text-muted-foreground">
          Spravujte profil organizácie
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Údaje organizácie</CardTitle>
          <CardDescription>
            Aktualizujte informácie o spoločnosti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Názov spoločnosti</FormLabel>
                    <FormControl>
                      <Input disabled={!isAdmin} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="ico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICO</FormLabel>
                      <FormControl>
                        <Input disabled={!isAdmin} {...field} />
                      </FormControl>
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
                        <Input disabled={!isAdmin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ic_dph"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IC DPH</FormLabel>
                      <FormControl>
                        <Input disabled={!isAdmin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address_street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica</FormLabel>
                    <FormControl>
                      <Input disabled={!isAdmin} {...field} />
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
                        <Input disabled={!isAdmin} {...field} />
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
                      <FormLabel>PSČ</FormLabel>
                      <FormControl>
                        <Input disabled={!isAdmin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank_iban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IBAN</FormLabel>
                      <FormControl>
                        <Input disabled={!isAdmin} {...field} />
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
                      <FormLabel>SWIFT</FormLabel>
                      <FormControl>
                        <Input disabled={!isAdmin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {form.watch("ic_dph") && (
                <div className="pt-2 border-t">
                  <FormItem>
                    <FormLabel>Frekvencia podávania DPH</FormLabel>
                    <Select
                      value={vatFilingFrequency}
                      onValueChange={setVatFilingFrequency}
                      disabled={!isAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte frekvenciu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Mesačne</SelectItem>
                        <SelectItem value="quarterly">Štvrťročne</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ako často podávate priznanie DPH daňovému úradu.
                    </p>
                  </FormItem>
                </div>
              )}
              {isAdmin ? (
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Ukladám..." : "Uložiť zmeny"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nastavenia organizácie môžu upravovať iba administrátori.
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Integrácie</h2>
        <EmailConnection />
      </div>
    </div>
  )
}
