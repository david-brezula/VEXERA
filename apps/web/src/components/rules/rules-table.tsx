"use client"

import { useState } from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { useRules, useToggleRule, useDeleteRule } from "@/hooks/use-rules"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RuleFormDialog } from "./rule-form-dialog"
import type { Rule, RuleTargetEntity } from "@vexera/types"

interface RulesTableProps {
  targetEntity?: RuleTargetEntity
}

export function RulesTable({ targetEntity }: RulesTableProps) {
  const [editingRule, setEditingRule] = useState<Rule | null>(null)

  const { data: rules = [], isLoading } = useRules({
    target_entity: targetEntity,
    active_only: false,
  })

  const toggleRule = useToggleRule()
  const deleteRule = useDeleteRule()

  function handleDelete(rule: Rule) {
    const confirmed = window.confirm(
      `Delete rule "${rule.name}"? This action cannot be undone.`
    )
    if (confirmed) {
      deleteRule.mutate(rule.id)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-md border py-16 text-center text-muted-foreground text-sm">
        Loading rules…
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border bg-card backdrop-blur-xl mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Target</TableHead>
              <TableHead className="w-28">Conditions</TableHead>
              <TableHead className="w-24">Actions</TableHead>
              <TableHead className="w-24">Applied</TableHead>
              <TableHead className="w-20">Active</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No rules found</p>
                    <p className="text-xs text-muted-foreground">
                      Create a rule to start automating categorization
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  {/* Priority */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono tabular-nums">
                      {rule.priority}
                    </Badge>
                  </TableCell>

                  {/* Name + description */}
                  <TableCell>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Target */}
                  <TableCell>
                    <Badge
                      variant={
                        rule.target_entity === "document"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {rule.target_entity === "document"
                        ? "Documents"
                        : "Transactions"}
                    </Badge>
                  </TableCell>

                  {/* Conditions count */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {rule.conditions.length}{" "}
                      {rule.conditions.length === 1
                        ? "condition"
                        : "conditions"}
                    </span>
                  </TableCell>

                  {/* Actions count */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {rule.actions.length}{" "}
                      {rule.actions.length === 1 ? "action" : "actions"}
                    </span>
                  </TableCell>

                  {/* Applied count */}
                  <TableCell>
                    <span className="text-sm tabular-nums">
                      {rule.applied_count > 0 ? rule.applied_count : "Never"}
                    </span>
                  </TableCell>

                  {/* Active toggle */}
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked: boolean) =>
                        toggleRule.mutate({ id: rule.id, is_active: checked })
                      }
                      disabled={toggleRule.isPending}
                    />
                  </TableCell>

                  {/* Actions menu */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Open menu"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingRule(rule)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(rule)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingRule && (
        <RuleFormDialog
          rule={editingRule}
          open={!!editingRule}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingRule(null)
          }}
        />
      )}
    </>
  )
}
