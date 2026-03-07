"use client"

import { useEffect } from "react"
import { useForm, useFieldArray, type Resolver, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ruleFormSchema, type RuleFormValues } from "@/lib/validations/rule.schema"
import { useCreateRule, useUpdateRule } from "@/hooks/use-rules"
import type { Rule } from "@vexera/types"

// ─── Options ─────────────────────────────────────────────────────────────────

const OPERATOR_OPTIONS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
] as const

const ACTION_TYPE_OPTIONS = [
  { value: "set_category", label: "Set category" },
  { value: "set_account", label: "Set account" },
  { value: "set_document_type", label: "Set document type" },
  { value: "set_tag", label: "Set tag" },
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

// ─── Component ───────────────────────────────────────────────────────────────

export function RuleFormDialog({ rule, open, onOpenChange }: RuleFormDialogProps) {
  const isEdit = !!rule
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const isPending = createRule.isPending || updateRule.isPending

  const form = useForm<RuleFormValues>({
    // Cast resolver to avoid @hookform/resolvers v5 + Zod v4 generic type mismatch
    resolver: zodResolver(ruleFormSchema) as unknown as Resolver<RuleFormValues>,
    defaultValues: {
      name: rule?.name ?? "",
      description: rule?.description ?? "",
      target_entity: rule?.target_entity ?? "document",
      priority: rule?.priority ?? 100,
      // RuleCondition.value is string | number; form schema expects string
      conditions: rule?.conditions?.map((c) => ({ ...c, value: String(c.value) })) ?? [{ field: "", operator: "contains" as const, value: "" }],
      actions: rule?.actions ?? [{ type: "set_category" as const, value: "" }],
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = form.control as Control<RuleFormValues, any, any>
  const conditionsArray = useFieldArray({ control: ctrl, name: "conditions" })
  const actionsArray = useFieldArray({ control: ctrl, name: "actions" })

  const targetEntity = form.watch("target_entity")
  const fieldOptions = targetEntity === "document" ? DOCUMENT_FIELD_OPTIONS : TRANSACTION_FIELD_OPTIONS

  // Reset form when rule changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: rule?.name ?? "",
        description: rule?.description ?? "",
        target_entity: rule?.target_entity ?? "document",
        priority: rule?.priority ?? 100,
        conditions: rule?.conditions?.map((c) => ({ ...c, value: String(c.value) })) ?? [{ field: "", operator: "contains" as const, value: "" }],
        actions: rule?.actions ?? [{ type: "set_category" as const, value: "" }],
      })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Rule" : "New Rule"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={(form.handleSubmit as any)(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={ctrl}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Auto-categorize utilities" {...field} />
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
                    <FormLabel>Target</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="document">Documents</SelectItem>
                        <SelectItem value="bank_transaction">Transactions</SelectItem>
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
                    <FormLabel>Priority</FormLabel>
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
                <FormLabel>Conditions (IF)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    conditionsArray.append({ field: "", operator: "contains", value: "" })
                  }
                >
                  <PlusIcon className="size-3 mr-1" /> Add
                </Button>
              </div>
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
                              <SelectValue placeholder="Field" />
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
                              <SelectValue placeholder="Operator" />
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
                          <Input placeholder="Value" {...field} />
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
                <FormLabel>Actions (THEN)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => actionsArray.append({ type: "set_category", value: "" })}
                >
                  <PlusIcon className="size-3 mr-1" /> Add
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
                              <SelectValue placeholder="Action" />
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
                  <FormField
                    control={ctrl}
                    name={`actions.${i}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Value" {...field} />
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
                    disabled={actionsArray.fields.length <= 1}
                    onClick={() => actionsArray.remove(i)}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
