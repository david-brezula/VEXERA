"use client"

import { Briefcase, Store, Calculator } from "lucide-react"
import type { OrganizationType } from "@vexera/types"
import { cn } from "@/lib/utils"

const ORG_TYPE_OPTIONS = [
  {
    type: "freelancer" as OrganizationType,
    label: "Zivnostnik",
    icon: Briefcase,
    bg: "bg-blue-500/10",
    color: "text-blue-500",
    description:
      "SZCO, samostatne zarabajuca osoba. Moznost pausalnych vydavkov alebo skutocnych nakladov.",
    available: true,
  },
  {
    type: "company" as OrganizationType,
    label: "Firma",
    icon: Store,
    bg: "bg-violet-500/10",
    color: "text-violet-500",
    description: "s.r.o., a.s. alebo ina pravnicka osoba.",
    available: false,
  },
  {
    type: "accounting_firm" as OrganizationType,
    label: "Uctovnik",
    icon: Calculator,
    bg: "bg-emerald-500/10",
    color: "text-emerald-500",
    description: "Uctovna firma alebo externy uctovnik.",
    available: false,
  },
]

export function StepOrgType({
  onSelect,
}: {
  onSelect: (type: OrganizationType) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ORG_TYPE_OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.type}
            type="button"
            disabled={!option.available}
            onClick={() => option.available && onSelect(option.type)}
            className={cn(
              "rounded-lg border p-6 space-y-3 text-left transition-all cursor-pointer",
              option.available
                ? "hover:border-primary hover:shadow-md"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cn("inline-flex rounded-md p-3", option.bg)}>
              <Icon className={cn("h-6 w-6", option.color)} />
            </div>
            <h3 className="text-base font-semibold">
              {option.label}
              {!option.available && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (Pripravujeme)
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {option.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
