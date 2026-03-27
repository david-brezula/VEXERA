import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

import { SupabaseProvider } from "@/providers/supabase-provider"
import { QueryProvider } from "@/providers/query-provider"
import { OrganizationProvider } from "@/providers/organization-provider"
import { Toaster } from "@/shared/components/ui/sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Vexera - Správa faktúr",
  description:
    "SaaS pre správu faktúr, účtovníctvo a vedenie účtovnej knihy",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <QueryProvider>
            <OrganizationProvider>
              {children}
              <Toaster />
            </OrganizationProvider>
          </QueryProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
