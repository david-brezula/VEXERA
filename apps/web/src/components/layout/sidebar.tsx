"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  BookOpen,
  Settings,
  Landmark,
  Zap,
  Download,
  Inbox,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { OrgSwitcher } from "./org-switcher"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/bank", label: "Bank", icon: Landmark },
  { href: "/rules", label: "Rules", icon: Zap },
  { href: "/accountant", label: "Clients", icon: Users },
  { href: "/export", label: "Export", icon: Download },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            Vexera
          </Link>
        </div>
        <div className="p-4">
          <OrgSwitcher />
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>
      </div>
    </aside>
  )
}
