"use client"

import { MoreHorizontal, Pause, Play, Trash2 } from "lucide-react"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { useToggleRecurringInvoice, useDeleteRecurringInvoice } from "../hooks-recurring"
import type { RecurringInvoiceTemplate, TemplateItem } from "../recurring.service"

interface RecurringTemplateTableProps {
  templates: RecurringInvoiceTemplate[]
}

const frequencyLabels: Record<string, string> = {
  weekly: "Týždenne",
  monthly: "Mesačne",
  quarterly: "Štvrťročne",
  yearly: "Ročne",
}

export function RecurringTemplateTable({ templates }: RecurringTemplateTableProps) {
  const toggleTemplate = useToggleRecurringInvoice()
  const deleteTemplate = useDeleteRecurringInvoice()

  if (templates.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Žiadne opakované faktúry. Vytvorte prvú šablónu.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Názov</TableHead>
          <TableHead>Zákazník</TableHead>
          <TableHead>Frekvencia</TableHead>
          <TableHead className="text-right">Suma</TableHead>
          <TableHead>Ďalšie vystavenie</TableHead>
          <TableHead className="text-center">Stav</TableHead>
          <TableHead className="text-right">Vystavených</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => {
          const total = (template.items as TemplateItem[]).reduce(
            (s, item) => s + item.quantity * item.unit_price_net * (1 + item.vat_rate / 100),
            0
          )

          return (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.template_name}</TableCell>
              <TableCell>{template.customer_name}</TableCell>
              <TableCell>{frequencyLabels[template.frequency] ?? template.frequency}</TableCell>
              <TableCell className="text-right tabular-nums">
                {total.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {template.currency}
              </TableCell>
              <TableCell>{new Date(template.next_run_at).toLocaleDateString("sk-SK")}</TableCell>
              <TableCell className="text-center">
                <Badge variant={template.is_active ? "secondary" : "outline"}>
                  {template.is_active ? "Aktívna" : "Pozastavená"}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{template.invoices_generated}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        toggleTemplate.mutate({
                          id: template.id,
                          is_active: !template.is_active,
                        })
                      }
                    >
                      {template.is_active ? (
                        <><Pause className="size-4 mr-2" /> Pozastaviť</>
                      ) : (
                        <><Play className="size-4 mr-2" /> Aktivovať</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteTemplate.mutate(template.id)}
                    >
                      <Trash2 className="size-4 mr-2" /> Odstrániť
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
