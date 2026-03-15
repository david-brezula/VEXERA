"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { useCurrentMemberRole } from "@/hooks/use-current-member-role"
import {
  createOrganizationSchema,
  type CreateOrganizationFormValues,
} from "@/lib/validations/organization.schema"
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
import { EmailConnection } from "@/components/settings/email-connection"

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
      ;(supabase as any)
        .from("organizations")
        .select("name, ico, dic, ic_dph, address_street, address_city, address_zip, address_country, email, phone, bank_iban, bank_swift, vat_filing_frequency")
        .eq("id", activeOrg.id)
        .single()
        .then(({ data }: { data: any }) => {
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
            setVatFilingFrequency(data.vat_filing_frequency ?? "quarterly")
          }
        })
    }
  }, [activeOrg, supabase, form])

  async function onSubmit(values: CreateOrganizationFormValues) {
    if (!activeOrg) return
    setIsLoading(true)

    try {
      const { error } = await (supabase as any)
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
      toast.success("Organization updated")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeOrg) {
    return <p className="text-muted-foreground">No organization selected.</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization profile
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>
            Update your company information.
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
                    <FormLabel>Company name</FormLabel>
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
                    <FormLabel>Street</FormLabel>
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
                      <FormLabel>City</FormLabel>
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
                      <FormLabel>ZIP</FormLabel>
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
                    <FormLabel>VAT Filing Frequency</FormLabel>
                    <Select
                      value={vatFilingFrequency}
                      onValueChange={setVatFilingFrequency}
                      disabled={!isAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      How often you file VAT returns with the tax authority.
                    </p>
                  </FormItem>
                </div>
              )}
              {isAdmin ? (
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save changes"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only admins can edit organization settings.
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <EmailConnection />
      </div>
    </div>
  )
}
