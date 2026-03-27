import { Suspense } from "react"
import { ContactsPageClient } from "@/features/contacts/components/contacts-page-client"

export const metadata = {
  title: "Contacts | Vexera",
}

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kontakty</h1>
        <p className="text-muted-foreground mt-1">
          Adresár klientov a dodávateľov s automatickým vyhľadávaním v registroch
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <ContactsPageClient />
      </Suspense>
    </div>
  )
}
