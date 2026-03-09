"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

// ─── Create org form (shown when no activeOrg exists) ─────────────────────────

function CreateOrganizationForm() {
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

      // Generate UUID client-side — avoids needing RETURNING on the INSERT,
      // which would fail the SELECT RLS policy before the membership row exists.
      const orgId = crypto.randomUUID()

      // Create organization
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
        })

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

      // Set active org cookie
      document.cookie = `active_organization_id=${encodeURIComponent(orgId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

      await queryClient.invalidateQueries({ queryKey: ["organizations"] })
      toast.success("Organization created successfully!")
      router.push("/")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create organization"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your organization</CardTitle>
          <CardDescription>
            Enter your company details to get started with Vexera. Fields marked
            with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Company information</h3>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name *</FormLabel>
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
                        <FormDescription>8-digit company ID</FormDescription>
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
                        <FormDescription>Tax ID</FormDescription>
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
                          <Input placeholder="SK1234567890" maxLength={12} {...field} />
                        </FormControl>
                        <FormDescription>VAT ID</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address</h3>
                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
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
                        <FormLabel>City</FormLabel>
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
                        <FormLabel>ZIP code</FormLabel>
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
                <h3 className="text-lg font-medium">Bank details</h3>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create organization"}
              </Button>
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

  // While the org state is loading, show nothing to avoid flicker
  if (isLoading) {
    return null
  }

  // If the user already has an org, show the setup wizard
  if (activeOrg) {
    return <OnboardingWizard />
  }

  // Otherwise show the org creation form
  return <CreateOrganizationForm />
}
