"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, useFieldArray, type Resolver, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, TrashIcon, FlaskConicalIcon } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog"
import { Input } from "@/shared/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { Label } from "@/shared/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { ruleFormSchema, type RuleFormValues } from "@/features/rules/schemas"
import { useCreateRule, useUpdateRule } from "../hooks"
import { getAccountOptionsAction, getCategoryOptionsAction, testRuleAction } from "../actions"
import type { Rule } from "@vexera/types"

// ─── Options ─────────────────────────────────────────────────────────────────

const OPERATOR_OPTIONS = [
  { value: "equals", label: "Rovná sa" },
  { value: "not_equals", label: "Nerovná sa" },
  { value: "contains", label: "Obsahuje" },
  { value: "not_contains", label: "Neobsahuje" },
  { value: "starts_with", label: "Začína na" },
  { value: "ends_with", label: "Končí na" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
] as const

const ACTION_TYPE_OPTIONS = [
  { value: "set_category", label: "Nastaviť kategóriu" },
  { value: "set_account", label: "Nastaviť účet" },
  { value: "set_document_type", label: "Nastaviť typ dokladu" },
  { value: "set_tag", label: "Nastaviť štítok" },
] as const

const DOCUMENT_FIELD_OPTIONS = [
  "name", "document_type", "mime_type", "supplier_name", "invoice_number", "total",
]

const TRANSACTION_FIELD_OPTIONS = [
  "description", "counterpart_name", "counterpart_iban", "variable_symbol", "amount", "currency",
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface RuleFormDialogProps {
  rule?: Rule
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Action value field ──────────────────────────────────────────────────────

function ActionValueField({
  ctrl,
  index,
  actionType,
  accountOptions,
  categoryOptions,
}: {
  ctrl: Control<RuleFormValues>
  index: number
  actionType: string
  accountOptions: { value: string; label: string }[]
  categoryOptions: string[]
}) {
  if (actionType === "set_account" && accountOptions.length > 0) {
    return (
      <FormField
        control={ctrl}
        name={`actions.${index}.value`}
        render={({ field }) => (
          <FormItem>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte účet" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accountOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  if (actionType === "set_category" && categoryOptions.length > 0) {
    return (
      <FormField
        control={ctrl}
        name={`actions.${index}.value`}
        render={({ field }) => (
          <FormItem>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte kategóriu" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <FormField
      control={ctrl}
      name={`actions.${index}.value`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input placeholder="Hodnota" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RuleFormDialog({ rule, open, onOpenChange }: RuleFormDialogProps) {
  const isEdit = !!rule
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const isPending = createRule.isPending || updateRule.isPending

  // Dropdown options state
  const [accountOptions, setAccountOptions] = useState<{ value: string; label: string }[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])

  // Test rule state
  const [testPending, startTestTransition] = useTransition()
  const [testResult, setTestResult] = useState<{
    matches: { id: string; description: string; amount: number | null; date: string | null; actions: Record<string, string> }[]
    total: number
  } | null>(null)

  const form = useForm<RuleFormValues>({
    // Cast resolver to avoid @hookform/resolvers v5 + Zod v4 generic type mismatch
    resolver: zodResolver(ruleFormSchema) as unknown as Resolver<RuleFormValues>,
    defaultValues: {
      name: rule?.name ?? "",
      description: rule?.description ?? "",
      target_entity: rule?.target_entity ?? "document",
      priority: rule?.priority ?? 100,
      logic_operator: rule?.logic_operator ?? "AND",
      // RuleCondition.value is string | number; form schema expects string
      conditions: rule?.conditions?.map((c) => ({ ...c, value: String(c.value) })) ?? [{ field: "", operator: "contains" as const, value: "" }],
      actions: rule?.actions ?? [{ type: "set_category" as const, value: "" }],
    },
  })

  const ctrl = form.control as Control<RuleFormValues>
  const conditionsArray = useFieldArray({ control: ctrl, name: "conditions" })
  const actionsArray = useFieldArray({ control: ctrl, name: "actions" })

  const targetEntity = form.watch("target_entity")
  const fieldOptions = targetEntity === "document" ? DOCUMENT_FIELD_OPTIONS : TRANSACTION_FIELD_OPTIONS

  // Watch action types for dropdown rendering
  const watchedActions = form.watch("actions")

  // Load dropdown options on mount
  useEffect(() => {
    if (open) {
      getAccountOptionsAction().then(setAccountOptions).catch(() => setAccountOptions([]))
      getCategoryOptionsAction().then(setCategoryOptions).catch(() => setCategoryOptions([]))
    }
  }, [open])

  // Reset form when rule changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: rule?.name ?? "",
        description: rule?.description ?? "",
        target_entity: rule?.target_entity ?? "document",
        priority: rule?.priority ?? 100,
        logic_operator: rule?.logic_operator ?? "AND",
        conditions: rule?.conditions?.map((c) => ({ ...c, value: String(c.value) })) ?? [{ field: "", operator: "contains" as const, value: "" }],
        actions: rule?.actions ?? [{ type: "set_category" as const, value: "" }],
      })
      setTestResult(null)
    }
  }, [open, rule, form])

  async function onSubmit(values: RuleFormValues) {
    if (isEdit && rule) {
      await updateRule.mutateAsync({ id: rule.id, ...values })
    } else {
      await createRule.mutateAsync(values)
    }
    onOpenChange(false)
  }

  function handleTestRule() {
    const values = form.getValues()
    startTestTransition(async () => {
      const result = await testRuleAction({
        target_entity: values.target_entity,
        conditions: values.conditions,
        logic_operator: values.logic_operator ?? "AND",
        actions: values.actions,
      })
      setTestResult(result)
    })
  }

  function formatAmount(amount: number | null): string {
    if (amount == null) return "—"
    return new Intl.NumberFormat("sk-SK", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }

  function formatDate(date: string | null): string {
    if (!date) return "—"
    try {
      return new Date(date).toLocaleDateString()
    } catch {
      return date
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upraviť pravidlo" : "Nové pravidlo"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={ctrl}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Názov</FormLabel>
                  <FormControl>
                    <Input placeholder="napr. Automatická kategorizácia energií" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={ctrl}
                name="target_entity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cieľ</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="document">Doklady</SelectItem>
                        <SelectItem value="bank_transaction">Transakcie</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ctrl}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorita</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={9999} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Podmienky (AK)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    conditionsArray.append({ field: "", operator: "contains", value: "" })
                  }
                >
                  <PlusIcon className="size-3 mr-1" /> Pridať
                </Button>
              </div>

              {/* AND / OR toggle */}
              <FormField
                control={ctrl}
                name="logic_operator"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex items-center gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="AND" id="logic-and" />
                          <Label htmlFor="logic-and" className="font-normal cursor-pointer">
                            Splniť VŠETKY podmienky (A)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="OR" id="logic-or" />
                          <Label htmlFor="logic-or" className="font-normal cursor-pointer">
                            Splniť AKÚKOĽVEK podmienku (ALEBO)
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {conditionsArray.fields.map((condField, i) => (
                <div key={condField.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                  <FormField
                    control={ctrl}
                    name={`conditions.${i}.field`}
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pole" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fieldOptions.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ctrl}
                    name={`conditions.${i}.operator`}
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Operátor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OPERATOR_OPTIONS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ctrl}
                    name={`conditions.${i}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Hodnota" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 mt-0"
                    disabled={conditionsArray.fields.length <= 1}
                    onClick={() => conditionsArray.remove(i)}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Akcie (TAK)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => actionsArray.append({ type: "set_category", value: "" })}
                >
                  <PlusIcon className="size-3 mr-1" /> Pridať
                </Button>
              </div>
              {actionsArray.fields.map((actField, i) => (
                <div key={actField.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <FormField
                    control={ctrl}
                    name={`actions.${i}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Akcia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTION_TYPE_OPTIONS.map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <ActionValueField
                    ctrl={ctrl}
                    index={i}
                    actionType={watchedActions?.[i]?.type ?? ""}
                    accountOptions={accountOptions}
                    categoryOptions={categoryOptions}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 mt-0"
                    disabled={actionsArray.fields.length <= 1}
                    onClick={() => actionsArray.remove(i)}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Test Rule */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testPending}
                onClick={handleTestRule}
              >
                <FlaskConicalIcon className="size-3 mr-1" />
                {testPending ? "Testujem..." : "Otestovať pravidlo"}
              </Button>

              {testResult && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {testResult.total} zhôd nájdených (zo 100 prehľadaných)
                  </p>
                  {testResult.matches.length > 0 && (
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Popis</TableHead>
                            <TableHead className="text-right">Suma</TableHead>
                            <TableHead>Dátum</TableHead>
                            <TableHead>Akcie na použitie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testResult.matches.slice(0, 20).map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="max-w-[200px] truncate">{m.description}</TableCell>
                              <TableCell className="text-right">{formatAmount(m.amount)}</TableCell>
                              <TableCell>{formatDate(m.date)}</TableCell>
                              <TableCell className="text-xs">
                                {Object.entries(m.actions).map(([k, v]) => (
                                  <span key={k} className="mr-2">{k}={v}</span>
                                ))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Zrušiť
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Ukladám..." : isEdit ? "Uložiť zmeny" : "Vytvoriť pravidlo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
