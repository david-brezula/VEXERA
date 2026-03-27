// ─── Service & Types ────────────────────────────────────────────────────────
export {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  importFromInvoices,
  updateContactStats,
} from "./service"
export type { Contact, CreateContactInput, ContactFilters } from "./service"

// ─── Server Actions ─────────────────────────────────────────────────────────
export { searchContactsAction } from "./actions"

// ─── Client Hooks ───────────────────────────────────────────────────────────
export {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useImportContacts,
  useLookupICO,
} from "./hooks"

// ─── Components ─────────────────────────────────────────────────────────────
export { ContactForm } from "./components/contact-form"
export { ContactTable } from "./components/contact-table"
export { ContactsPageClient } from "./components/contacts-page-client"
export { ICOLookupInput } from "./components/ico-lookup-input"
