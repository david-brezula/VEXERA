"use client"

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
import { MoreHorizontal, Star, Trash2, Pencil } from "lucide-react"
import type { Contact } from "../service"

interface ContactTableProps {
  contacts: Contact[]
  onEdit?: (contact: Contact) => void
  onDelete?: (contactId: string) => void
}

const typeLabels: Record<string, string> = {
  client: "Klient",
  supplier: "Dodávateľ",
  both: "Klient / Dodávateľ",
}

export function ContactTable({ contacts, onEdit, onDelete }: ContactTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Žiadne kontakty
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Názov</TableHead>
          <TableHead>IČO</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Mesto</TableHead>
          <TableHead className="text-right">Fakturované</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{contact.name}</span>
                {contact.is_key_client && (
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{contact.ico ?? "—"}</TableCell>
            <TableCell>
              <Badge variant="outline">{typeLabels[contact.contact_type] ?? contact.contact_type}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{contact.email ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{contact.city ?? "—"}</TableCell>
            <TableCell className="text-right">
              {contact.total_invoiced > 0
                ? `${contact.total_invoiced.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €`
                : "—"}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(contact)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upraviť
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete?.(contact.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Odstrániť
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
