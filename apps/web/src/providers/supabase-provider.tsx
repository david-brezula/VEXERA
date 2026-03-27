"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@vexera/types"

type SupabaseContext = {
  supabase: SupabaseClient<Database>
  user: User | null
  isLoading: boolean
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setIsLoading(false)

        // Upsert profile to handle users created before the DB trigger was deployed
        if (currentUser) {
          supabase.from("profiles").upsert(
            {
              id: currentUser.id,
              email: currentUser.email ?? "",
              full_name: currentUser.user_metadata?.full_name ?? null,
              avatar_url: currentUser.user_metadata?.avatar_url ?? null,
            },
            { onConflict: "id" }
          )
        }
      })
      subscription = data.subscription
    } catch {
      // Supabase may be unreachable — gracefully degrade
      setIsLoading(false)
    }

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  return (
    <Context.Provider value={{ supabase, user, isLoading }}>
      {children}
    </Context.Provider>
  )
}

export function useSupabase() {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error("useSupabase must be used inside SupabaseProvider")
  }
  return context
}
