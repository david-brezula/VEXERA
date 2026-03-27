"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Plus, Upload, Search } from "lucide-react"
import { ContactTable } from "./contact-table"
import { ContactForm } from "./contact-form"
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useImportContacts,
} from "../hooks"
import type { Contact } from "../service"

export function ContactsPageClient() {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const typeFilter = tab === "all" ? undefined : tab
  const { data: contacts, isLoading } = useContacts({
    type: typeFilter,
    search: search || undefined,
  })
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const importContacts = useImportContacts()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreate = (data: any) => {
    createContact.mutate(data as Record<string, unknown>, {
      onSuccess: () => setDialogOpen(false),
    })
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setDialogOpen(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdate = (data: any) => {
    if (!editingContact) return
    updateContact.mutate(
      { id: editingContact.id, ...(data as Record<string, unknown>) },
      { onSuccess: () => { setDialogOpen(false); setEditingContact(null) } }
    )
  }

  const handleDelete = (id: string) => {
    deleteContact.mutate(id)
  }

  const handleNewClick = () => {
    setEditingContact(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa názvu alebo IČO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => importContacts.mutate()} disabled={importContacts.isPending}>
          <Upload className="mr-2 h-4 w-4" />
          Importovať z faktúr
        </Button>
        <Button onClick={handleNewClick}>
          <Plus className="mr-2 h-4 w-4" />
          Nový kontakt
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Všetky</TabsTrigger>
          <TabsTrigger value="client">Klienti</TabsTrigger>
          <TabsTrigger value="supplier">Dodávatelia</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">Načítavam...</div>
              ) : (
                <ContactTable
                  contacts={contacts ?? []}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingContact(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Upraviť kontakt" : "Nový kontakt"}
            </DialogTitle>
          </DialogHeader>
          <ContactForm
            initialData={editingContact ? {
              name: editingContact.name,
              ico: editingContact.ico ?? "",
              dic: editingContact.dic ?? "",
              ic_dph: editingContact.ic_dph ?? "",
              contact_type: editingContact.contact_type,
              street: editingContact.street ?? "",
              city: editingContact.city ?? "",
              postal_code: editingContact.postal_code ?? "",
              country: editingContact.country,
              email: editingContact.email ?? "",
              phone: editingContact.phone ?? "",
              website: editingContact.website ?? "",
              bank_account: editingContact.bank_account ?? "",
              is_key_client: editingContact.is_key_client,
              notes: editingContact.notes ?? "",
            } : undefined}
            onSubmit={editingContact ? handleUpdate : handleCreate}
            onCancel={() => { setDialogOpen(false); setEditingContact(null) }}
            isLoading={createContact.isPending || updateContact.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
