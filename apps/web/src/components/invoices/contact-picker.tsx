"use client"

import * as React from "react"
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { searchContactsAction } from "@/lib/actions/contacts"
import type { Contact } from "@/lib/services/contacts.service"

type Props = {
  contactType: "supplier" | "client"
  onSelect: (contact: Contact) => void
}

export function ContactPicker({ contactType, onSelect }: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedName, setSelectedName] = React.useState("")

  React.useEffect(() => {
    if (!open) return

    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const results = await searchContactsAction(search, contactType)
        setContacts(results)
      } catch {
        setContacts([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [open, search, contactType])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between sm:w-[300px]"
        >
          {selectedName || `Select ${contactType}...`}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${contactType}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>No {contactType} found.</CommandEmpty>
                <CommandGroup>
                  {contacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={() => {
                        setSelectedName(contact.name)
                        onSelect(contact)
                        setOpen(false)
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{contact.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {contact.ico ? `ICO: ${contact.ico}` : ""}
                          {contact.ico && contact.city ? " - " : ""}
                          {contact.city ?? ""}
                        </span>
                      </div>
                      <CheckIcon
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedName === contact.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
