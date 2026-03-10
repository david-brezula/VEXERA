// Auto-generated Supabase types placeholder
// Run `pnpm db:generate-types` to regenerate from your Supabase schema
// Command: supabase gen types typescript --project-id <your-project-id> > src/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Minimal table types for development — will be replaced by supabase gen types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          ico: string
          dic: string | null
          ic_dph: string | null
          address_street: string | null
          address_city: string | null
          address_zip: string | null
          address_country: string
          phone: string | null
          email: string | null
          website: string | null
          bank_iban: string | null
          bank_swift: string | null
          logo_url: string | null
          logo_path: string | null
          subscription_plan: string
          organization_type: string
          storage_used_bytes: number
          peppol_endpoint_id: string | null
          peppol_scheme: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          ico: string
          dic?: string | null
          ic_dph?: string | null
          address_street?: string | null
          address_city?: string | null
          address_zip?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          website?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          logo_url?: string | null
          logo_path?: string | null
          subscription_plan?: string
          organization_type?: string
          storage_used_bytes?: number
          peppol_endpoint_id?: string | null
          peppol_scheme?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          ico?: string
          dic?: string | null
          ic_dph?: string | null
          address_street?: string | null
          address_city?: string | null
          address_zip?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          website?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          logo_url?: string | null
          logo_path?: string | null
          subscription_plan?: string
          organization_type?: string
          storage_used_bytes?: number
          peppol_endpoint_id?: string | null
          peppol_scheme?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          organization_id?: string
          user_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          invited_by: string
          invited_email: string
          role: string
          token: string
          status: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invited_by: string
          invited_email: string
          role: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string
        }
        Update: {
          status?: string
        }
        Relationships: []
      }
      accountant_clients: {
        Row: {
          id: string
          accountant_id: string
          organization_id: string
          invitation_id: string | null
          status: string
          permissions: Json
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          accountant_id: string
          organization_id: string
          invitation_id?: string | null
          status?: string
          permissions?: Json
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          permissions?: Json
          revoked_at?: string | null
        }
        Relationships: []
      }
      freelancer_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          tax_regime: string
          registered_dph: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          tax_regime: string
          registered_dph?: boolean
          created_at?: string
        }
        Update: {
          ico?: string | null
          tax_regime?: string
          registered_dph?: boolean
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          ic_dph: string | null
          dph_status: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          ic_dph?: string | null
          dph_status: string
          created_at?: string
        }
        Update: {
          ico?: string | null
          ic_dph?: string | null
          dph_status?: string
        }
        Relationships: []
      }
      accounting_firm_profiles: {
        Row: {
          id: string
          organization_id: string
          referral_code: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          referral_code?: string
          created_at?: string
        }
        Update: {
          referral_code?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          id: string
          organization_id: string | null
          account_number: string
          account_name: string
          account_class: string
          account_type: string
          parent_id: string | null
          is_active: boolean
          is_system: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          account_number: string
          account_name: string
          account_class: string
          account_type: string
          parent_id?: string | null
          is_active?: boolean
          is_system?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          account_number?: string
          account_name?: string
          account_class?: string
          account_type?: string
          parent_id?: string | null
          is_active?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          invoice_number: string
          invoice_type: string
          status: string
          supplier_name: string
          supplier_ico: string | null
          supplier_dic: string | null
          supplier_ic_dph: string | null
          supplier_address: string | null
          supplier_iban: string | null
          customer_name: string
          customer_ico: string | null
          customer_dic: string | null
          customer_ic_dph: string | null
          customer_address: string | null
          issue_date: string
          delivery_date: string | null
          due_date: string
          paid_at: string | null
          subtotal: number
          vat_amount: number
          total: number
          currency: string
          payment_method: string | null
          bank_iban: string | null
          variable_symbol: string | null
          constant_symbol: string | null
          specific_symbol: string | null
          notes: string | null
          internal_notes: string | null
          file_path: string | null
          file_url: string | null
          peppol_id: string | null
          peppol_status: string | null
          peppol_sent_at: string | null
          closed_by: string | null
          closed_at: string | null
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit: string | null
          unit_price: number
          vat_rate: number
          vat_amount: number
          total: number
          sort_order: number
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string | null
          name: string
          file_path: string
          file_size_bytes: number | null
          mime_type: string | null
          checksum_sha256: string | null
          document_type: string | null
          retention_until: string
          is_archived: boolean
          ocr_status: string
          ocr_data: Json | null
          ocr_processed_at: string | null
          uploaded_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      ledger_entries: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string | null
          document_id: string | null
          entry_date: string
          period_year: number
          period_month: number
          description: string
          reference_number: string | null
          debit_account_id: string | null
          credit_account_id: string | null
          debit_account_number: string
          credit_account_number: string
          amount: number
          currency: string
          status: string
          is_closing_entry: boolean
          reversed_by: string | null
          created_by: string | null
          posted_by: string | null
          posted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_data: Json | null
          new_data: Json | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: string
          status: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
