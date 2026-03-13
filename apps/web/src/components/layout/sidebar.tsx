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
  Receipt,
  Calculator,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { OrgSwitcher } from "./org-switcher"
import { ScrollArea } from "@/components/ui/scroll-area"

// ─── Nav structure ────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/bank", label: "Bank", icon: Landmark },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/rules", label: "Rules", icon: Zap },
      { href: "/export", label: "Export", icon: Download },
    ],
  },
  {
    label: "Tax",
    items: [
      { href: "/tax/vat", label: "VAT Returns", icon: Receipt },
      { href: "/tax/income", label: "Income Tax", icon: Calculator },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/accountant", label: "Clients", icon: Users },
      { href: "/ledger", label: "Ledger", icon: BookOpen },
    ],
  },
]

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
]

// ─── Logo mark ────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 group">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm group-hover:opacity-90 transition-opacity">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-sidebar-primary-foreground"
        >
          <path
            d="M2 3L6 13L8 7L10 13L14 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="font-semibold text-[15px] tracking-tight text-sidebar-foreground">
        Vexera
      </span>
    </Link>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string
  label: string
  icon: React.ElementType
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-white/10 backdrop-blur-sm text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
  }

  return (
    <aside className="hidden w-[220px] shrink-0 md:flex flex-col bg-sidebar/90 backdrop-blur-xl border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <Logo />
      </div>

      {/* Org switcher */}
      <div className="px-3 pt-3 pb-2">
        <OrgSwitcher />
      </div>

      {/* Nav groups */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom: settings */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        {bottomItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isActive(item.href)}
          />
        ))}
      </div>
    </aside>
  )
}
