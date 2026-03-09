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
  Users,
  FileText,
  Landmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Mail,
  Upload,
  ArrowRight,
} from "lucide-react"

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

const step1Schema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  ico: z.string().optional(),
  dic: z.string().optional(),
  ic_dph: z.string().optional(),
  address_country: z.string().optional(),
})

const step2Schema = z.object({
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  email: z
    .string()
    .email({ message: "Enter a valid email address" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
})

const step3Schema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
  role: z.enum(["editor", "viewer"]),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>
type Step3Values = z.infer<typeof step3Schema>

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Organization Profile", icon: Building2 },
  { id: 2, label: "Contact & Address", icon: MapPin },
  { id: 3, label: "Invite Team", icon: Users },
  { id: 4, label: "Documents", icon: FileText },
  { id: 5, label: "Bank", icon: Landmark },
] as const

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Step {currentStep} of {STEPS.length} —{" "}
          <span className="text-foreground font-semibold">
            {STEPS[currentStep - 1]?.label}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round(((currentStep - 1) / STEPS.length) * 100)}% complete
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

// ─── Step 1: Organization Profile ─────────────────────────────────────────────

function Step1Form({
  onNext,
  orgName,
}: {
  onNext: () => void
  orgName: string
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema) as unknown as Resolver<Step1Values>,
    defaultValues: {
      name: orgName,
      ico: "",
      dic: "",
      ic_dph: "",
      address_country: "SK",
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
      toast.success("Organization profile saved")
      onNext()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save organization profile"
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
                <FormLabel>ICO</FormLabel>
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

        <FormField
          control={form.control}
          name="address_country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SK">Slovakia</SelectItem>
                  <SelectItem value="CZ">Czech Republic</SelectItem>
                  <SelectItem value="AT">Austria</SelectItem>
                  <SelectItem value="HU">Hungary</SelectItem>
                  <SelectItem value="PL">Poland</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Continue"}
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
      toast.success("Contact details saved")
      onNext()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save contact details"
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
              <FormLabel>Street address</FormLabel>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="info@company.sk"
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
                <FormLabel>Phone number</FormLabel>
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
            Back
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Continue"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 3: Invite Team Member ───────────────────────────────────────────────

function Step3Form({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema) as unknown as Resolver<Step3Values>,
    defaultValues: {
      email: "",
      role: "editor",
    },
  })

  async function onSubmit(values: Step3Values) {
    if (!activeOrg || !user) return
    setIsLoading(true)
    try {
      // The placeholder DB types don't include invited_email/invited_by
      // (added in migration 21). Cast to any to bypass stale type definitions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("organization_members") as any).insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        invited_email: values.email,
        role: values.role,
        invited_by: user.id,
      })

      if (error) throw error
      toast.success(`Invitation sent to ${values.email}`)
      onNext()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send invitation"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team member email *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="colleague@company.sk"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  They will receive an email invitation to join your organization.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="editor">
                      Editor — can create and edit records
                    </SelectItem>
                    <SelectItem value="viewer">
                      Viewer — read-only access
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onNext}
                className="text-muted-foreground"
              >
                Skip this step
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Invite"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}

// ─── Step 4: Documents guidance ───────────────────────────────────────────────

function Step4Guidance({
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
      title: "Manual upload",
      description:
        "Drag and drop PDFs, JPGs, or PNGs directly from your computer.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Mail,
      title: "Gmail auto-import",
      description:
        "Connect your Gmail account and we will automatically pull in invoices and receipts.",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      icon: ArrowRight,
      title: "Forward by email",
      description:
        "Forward emails with attachments to your unique Vexera inbox address.",
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
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onNext}
            className="text-muted-foreground"
          >
            Skip this step
          </Button>
          <Button type="button" onClick={goToDocuments}>
            <FileText className="h-4 w-4 mr-2" />
            Go to Documents
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 5: Bank guidance ────────────────────────────────────────────────────

function Step5Guidance({
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
            <h3 className="font-semibold">Import your bank statement</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload your bank statement in MT940 or CSV format. Vexera will
              automatically match transactions to your invoices using the VS
              (variable symbol) and amount.
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
          Go to Bank Import
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={onFinish}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Finish setup
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
        <h2 className="text-2xl font-bold">You are all set!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Your organization is configured and ready to go. Start managing your
          accounting with Vexera.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/invoices/new">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Create first invoice
          </Button>
        </Link>
        <Button onClick={onDone}>
          Go to Dashboard
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
  const [currentStep, setCurrentStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)

  function goNext() {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length))
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  function handleFinish() {
    localStorage.setItem("onboarding_complete", "true")
    setIsComplete(true)
  }

  function handleDone() {
    router.push("/")
  }

  const stepTitles: Record<number, { title: string; description: string }> = {
    1: {
      title: "Organization profile",
      description: "Tell us about your company so invoices and documents look professional.",
    },
    2: {
      title: "Contact & address",
      description: "Add your contact details and office address.",
    },
    3: {
      title: "Invite a team member",
      description: "Collaborate with colleagues by inviting them to your organization.",
    },
    4: {
      title: "Get your documents in",
      description: "Choose how you want to import invoices and receipts.",
    },
    5: {
      title: "Connect your bank",
      description: "Import bank statements for automatic transaction matching.",
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
          {currentStep === 1 && (
            <Step1Form onNext={goNext} orgName={activeOrg?.name ?? ""} />
          )}
          {currentStep === 2 && (
            <Step2Form onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 3 && (
            <Step3Form onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 4 && (
            <Step4Guidance onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 5 && (
            <Step5Guidance onFinish={handleFinish} onBack={goBack} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
