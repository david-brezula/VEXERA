"use client"

import { ChevronsUpDown, Plus, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { useOrganization } from "@/providers/organization-provider"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"

export function OrgSwitcher() {
  const { activeOrg, userOrgs, switchOrg } = useOrganization()
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {activeOrg?.name ?? "Vyberte organizáciu"}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Vaše organizácie</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userOrgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrg(org.id)}
            className={org.id === activeOrg?.id ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="truncate">{org.name}</span>
              <span className="text-xs text-muted-foreground">
                {org.ico}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/onboarding")}>
          <Plus className="mr-2 h-4 w-4" />
          Vytvoriť organizáciu
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
