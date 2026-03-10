"use client"

import { useRouter, usePathname } from "next/navigation"
import { LogOut, User, Menu } from "lucide-react"

import { useSupabase } from "@/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationsBell } from "./notifications-bell"

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/invoices": "Invoices",
  "/documents": "Documents",
  "/bank": "Bank",
  "/rules": "Rules",
  "/accountant": "Clients",
  "/export": "Export",
  "/ledger": "Ledger",
  "/settings": "Settings",
  "/onboarding": "Setup Guide",
}

function usePageTitle() {
  const pathname = usePathname()
  // Match exact first, then prefix
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PAGE_TITLES[match] : ""
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { supabase, user } = useSupabase()
  const router = useRouter()
  const pageTitle = usePageTitle()

  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U"

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--glass-border)] bg-background/70 backdrop-blur-xl px-6 shrink-0">
      {/* Mobile logo / Page title */}
      <div className="flex items-center gap-3">
        <span className="md:hidden font-bold text-base">Vexera</span>
        {pageTitle && (
          <h1 className="hidden md:block text-sm font-semibold text-foreground">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-1">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.user_metadata?.avatar_url}
                  alt={user?.user_metadata?.full_name ?? "User"}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {user?.user_metadata?.full_name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
